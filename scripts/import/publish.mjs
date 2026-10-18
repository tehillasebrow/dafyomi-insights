// Publishes staged newspaper articles (data/import/) to the site.
//
//   npm run import:publish -- --dry-run     shows what would happen, changes nothing
//   npm run import:publish                  publishes articles whose review status is
//                                           "approved" or "fixed" (set by the review step)
//   npm run import:publish -- --clean       also publishes pending articles with no serious
//                                           warnings (what the weekly job uses)
//
// Each article is matched to the database by source_url, so running it twice never
// makes a duplicate. An article whose title is already on the site (typed in by hand
// before the importer existed) is skipped and listed, never overwritten.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs, writeClient, readClient, revalidateSite, validateDraft, saveStories, topicVocabulary } from '../lib/stories.mjs'
import { listStaged, writeJson, writeReviewCsv, slugify, seriousWarnings } from './lib/staging.mjs'
import { loadTopics, cleanTags } from '../topics/lib.mjs'
import { findMasechta } from '../../app/lib/shas.js'
import { uploadPhoto } from '../photos/lib.mjs'

const READY = new Set(['approved', 'fixed'])
const topics = loadTopics()
let warnedRefs = false

// Other places the article discusses, with canonical masechta names, without
// its own place, and without duplicates
function cleanRefs(article) {
    const own = findMasechta(article.masechta)?.name ?? article.masechta
    const seen = new Set()
    const out = []
    for (const r of article.refs ?? []) {
        const masechta = findMasechta(r?.masechta)?.name
        const daf = Number(r?.daf)
        if (!masechta || !Number.isInteger(daf)) continue
        if (masechta === own && daf >= article.daf && daf <= (article.daf_end ?? article.daf)) continue
        const k = `${masechta}|${daf}`
        if (seen.has(k)) continue
        seen.add(k)
        out.push(r.daf_end ? { masechta, daf, daf_end: Number(r.daf_end) } : { masechta, daf })
    }
    return out
}
const normalizeTitle = t => slugify(t).replace(/^the-/, '')

export function isPublishable(article, { clean = false } = {}) {
    const status = article.review?.status || 'pending'
    if (READY.has(status)) return true
    return clean && status === 'pending' && !seriousWarnings(article).length
}

// Asks the site to email the admin a preview of each new article, to approve before
// it goes to subscribers. The site ignores articles dated more than 7 days ago, so a
// backfill of old columns never emails anyone. Never fails the import.
async function queueNewsletter(ids, log) {
    const secret = process.env.REVALIDATE_SECRET
    const site = process.env.SITE_URL || 'https://dafyomiinsights.com'
    if (!secret) return log('REVALIDATE_SECRET not set: no preview email sent for the mailing list')
    try {
        const res = await fetch(`${site}/api/newsletter/queue`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) return log(`Mailing list: HTTP ${res.status}`)
        const queued = (body.results || []).filter(r => r.queued).length
        log(`Mailing list: ${queued ? `preview email sent for ${queued} new article${queued === 1 ? '' : 's'}` : 'no new preview email needed'}`)
    } catch (err) {
        log(`Mailing list: ${err.message}`)
    }
}

// only: a Set of staged folders to consider (the weekly run passes the ones it just found)
export async function publish({ dryRun = false, clean = false, only = null, log = console.log } = {}) {
    const db = dryRun ? readClient() : writeClient()
    const { data: existing, error } = await db.from('articles').select('id, title, slug, masechta, daf, source_url')
    if (error) throw new Error(`Could not read articles: ${error.message}`)
    const bySourceUrl = new Map(existing.filter(a => a.source_url).map(a => [a.source_url, a]))
    const byTitle = new Map(existing.map(a => [normalizeTitle(a.title), a]))
    // The database keeps article slugs unique across the whole site (articles_slug_key)
    const slugsTaken = new Set(existing.map(a => a.slug))

    const result = { published: [], updated: [], duplicates: [], skipped: 0, failed: [] }
    const newIds = [] // newly inserted (not updated) articles from the last week, for the mailing list
    for (const { dir, file, article } of listStaged()) {
        if (only && !only.has(dir)) continue
        if (article.review?.status === 'published' && bySourceUrl.has(article.source_url)) {
            result.skipped++
            continue
        }
        if (!isPublishable(article, { clean })) {
            result.skipped++
            continue
        }

        const current = bySourceUrl.get(article.source_url)
        const sameTitle = byTitle.get(normalizeTitle(article.title))
        if (!current && sameTitle && !sameTitle.source_url) {
            result.duplicates.push({ title: article.title, existing: sameTitle })
            log(`  already on the site (added by hand): ${article.title}  [id ${sameTitle.id}]`)
            continue
        }

        // "standalone": true is a piece that isn't on a daf (tribute, Q&A, magazine piece).
        // It has no masechta/daf and lives at /beyond-the-daf/{slug}. Anything else must
        // have a real masechta and daf.
        const standalone = article.standalone === true
        if (!standalone && (!findMasechta(article.masechta) || !Number.isInteger(article.daf))) {
            const error = `no valid masechta/daf (masechta: ${JSON.stringify(article.masechta ?? null)}, daf: ${JSON.stringify(article.daf ?? null)}). Fix them, or set "standalone": true if it isn't about a daf`
            result.failed.push({ title: article.title, error })
            log(`  FAILED: ${article.title}: ${error}`)
            continue
        }
        if (!article.source_url) {
            result.failed.push({ title: article.title, error: 'no source_url' })
            log(`  FAILED: ${article.title}: no source_url`)
            continue
        }
        const masechta = standalone ? null : article.masechta
        const where = standalone ? 'Beyond the Daf' : `${article.masechta} ${article.daf}`

        // Keep slugs unique (two columns can share a title): add the year, then a number
        // (from the reviewed title: a reviewer may have corrected the headline after import;
        // an article already on the site keeps its address)
        let slug = current?.slug || slugify(article.title) || article.slug
        if (!current && slugsTaken.has(slug)) {
            const base = `${slug}-${article.published_at.slice(0, 4)}`
            slug = base
            for (let n = 2; slugsTaken.has(slug); n++) slug = `${base}-${n}`
        }

        const row = {
            title: article.title,
            slug,
            masechta,
            daf: standalone ? null : article.daf,
            daf_end: standalone ? null : article.daf_end ?? null,
            summary: article.summary,
            content: article.content,
            tags: cleanTags(article.tags, topics).tags, // topic and subtopic names from data/topics.json only
            refs: standalone ? [] : cleanRefs(article),
            source: article.source,
            source_url: article.source_url,
            published_at: article.published_at,
        }

        if (dryRun) {
            log(`  would ${current ? 'update' : 'publish'}: ${article.published_at.slice(0, 10)} ${article.title} (${where})`)
            ;(current ? result.updated : result.published).push(article.title)
            continue
        }

        try {
            const photoFile = article.photo && path.join(dir, article.photo)
            if (photoFile && fs.existsSync(photoFile)) {
                row.image_url = await uploadPhoto(db, `imports/${article.source}/${path.basename(dir)}`, photoFile)
                if (article.photo_credit) row.image_credit = article.photo_credit // a free-license photo (scripts/photos/)
            }
            let { data, error: upsertErr } = await db.from('articles').upsert(row, { onConflict: 'source_url' }).select('id').single()
            for (let retry = 0; retry < 2 && upsertErr; retry++) {
                if ('refs' in row && /refs/.test(upsertErr.message)) {
                    // The article_refs migration hasn't been applied yet: publish without the extra places
                    if (!warnedRefs) log('  note: articles.refs is missing (run supabase/migrations/20261012000000_article_refs.sql); publishing without extra masechta/daf places')
                    warnedRefs = true
                    delete row.refs
                } else break
                ;({ data, error: upsertErr } = await db.from('articles').upsert(row, { onConflict: 'source_url' }).select('id').single())
            }
            if (upsertErr) throw new Error(upsertErr.message)

            // Gemara stories found during review (article.stories), cut from the article text
            if (Array.isArray(article.stories)) {
                const { stories, errors } = validateDraft({ stories: article.stories }, { content: article.content }, topicVocabulary())
                if (errors.length) log(`  stories skipped for "${article.title}": ${errors.join('; ')}`)
                else {
                    try {
                        const saved = await saveStories(db, { id: data.id, masechta, daf: row.daf }, stories)
                        if (saved.length) log(`    + ${saved.length} stor${saved.length === 1 ? 'y' : 'ies'}`)
                    } catch (err) {
                        log(`  stories not saved for "${article.title}": ${err.message} (has the stories migration been run?)`)
                    }
                }
            }

            article.review = { ...(article.review || {}), status: 'published', db_id: data.id, published_on: new Date().toISOString() }
            writeJson(file, article)
            slugsTaken.add(slug)
            ;(current ? result.updated : result.published).push(article.title)
            if (!current && Date.now() - new Date(article.published_at).getTime() < 7 * 86400000) newIds.push(data.id)
            log(`  ${current ? 'updated' : 'published'}: ${article.published_at.slice(0, 10)} ${article.title}`)
        } catch (err) {
            result.failed.push({ title: article.title, error: err.message })
            log(`  FAILED: ${article.title}: ${err.message}`)
        }
    }

    if (!dryRun && (result.published.length || result.updated.length)) await revalidateSite()
    if (!dryRun && newIds.length) await queueNewsletter(newIds, log)
    writeReviewCsv()
    return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = parseArgs()
    const r = await publish({ dryRun: Boolean(args['dry-run']), clean: Boolean(args.clean) })
    console.log(`\n${args['dry-run'] ? 'Dry run: ' : ''}${r.published.length} new, ${r.updated.length} updated, ${r.duplicates.length} already on the site, ${r.failed.length} failed, ${r.skipped} not ready`)
    if (r.failed.length) process.exitCode = 1
}

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
import { parseArgs, writeClient, readClient, revalidateSite } from '../lib/stories.mjs'
import { listStaged, writeJson, writeReviewCsv, slugify, seriousWarnings } from './lib/staging.mjs'

const READY = new Set(['approved', 'fixed'])
const normalizeTitle = t => slugify(t).replace(/^the-/, '')

export function isPublishable(article, { clean = false } = {}) {
    const status = article.review?.status || 'pending'
    if (READY.has(status)) return true
    return clean && status === 'pending' && !seriousWarnings(article).length
}

// only: a Set of staged folders to consider (the weekly run passes the ones it just found)
export async function publish({ dryRun = false, clean = false, only = null, log = console.log } = {}) {
    const db = dryRun ? readClient() : writeClient()
    const { data: existing, error } = await db.from('articles').select('id, title, slug, masechta, daf, source_url')
    if (error) throw new Error(`Could not read articles: ${error.message}`)
    const bySourceUrl = new Map(existing.filter(a => a.source_url).map(a => [a.source_url, a]))
    const byTitle = new Map(existing.map(a => [normalizeTitle(a.title), a]))
    const slugsTaken = new Set(existing.map(a => `${a.masechta.toLowerCase()}|${a.slug}`))

    const result = { published: [], updated: [], duplicates: [], skipped: 0, failed: [] }
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

        // Keep slugs unique within a masechta (two columns can share a title)
        let slug = current?.slug || article.slug
        if (!current && slugsTaken.has(`${article.masechta.toLowerCase()}|${slug}`)) slug = `${slug}-${article.published_at.slice(0, 4)}`

        const row = {
            title: article.title,
            slug,
            masechta: article.masechta,
            daf: article.daf,
            daf_end: article.daf_end ?? null,
            summary: article.summary,
            content: article.content,
            tags: article.tags || [],
            source: article.source,
            source_url: article.source_url,
            published_at: article.published_at,
        }

        if (dryRun) {
            log(`  would ${current ? 'update' : 'publish'}: ${article.published_at.slice(0, 10)} ${article.title} (${article.masechta} ${article.daf})`)
            ;(current ? result.updated : result.published).push(article.title)
            continue
        }

        try {
            const photoFile = article.photo && path.join(dir, article.photo)
            if (photoFile && fs.existsSync(photoFile)) {
                const key = `imports/${article.source}/${path.basename(dir)}.jpg`
                const { error: upErr } = await db.storage.from('images').upload(key, fs.readFileSync(photoFile), { contentType: 'image/jpeg', upsert: true })
                if (upErr) throw new Error(`photo upload: ${upErr.message}`)
                row.image_url = db.storage.from('images').getPublicUrl(key).data.publicUrl
            }
            const { data, error: upsertErr } = await db.from('articles').upsert(row, { onConflict: 'source_url' }).select('id').single()
            if (upsertErr) throw new Error(upsertErr.message)

            article.review = { ...(article.review || {}), status: 'published', db_id: data.id, published_on: new Date().toISOString() }
            writeJson(file, article)
            slugsTaken.add(`${article.masechta.toLowerCase()}|${slug}`)
            ;(current ? result.updated : result.published).push(article.title)
            log(`  ${current ? 'updated' : 'published'}: ${article.published_at.slice(0, 10)} ${article.title}`)
        } catch (err) {
            result.failed.push({ title: article.title, error: err.message })
            log(`  FAILED: ${article.title}: ${err.message}`)
        }
    }

    if (!dryRun && (result.published.length || result.updated.length)) await revalidateSite()
    writeReviewCsv()
    return result
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = parseArgs()
    const r = await publish({ dryRun: Boolean(args['dry-run']), clean: Boolean(args.clean) })
    console.log(`\n${args['dry-run'] ? 'Dry run: ' : ''}${r.published.length} new, ${r.updated.length} updated, ${r.duplicates.length} already on the site, ${r.failed.length} failed, ${r.skipped} not ready`)
    if (r.failed.length) process.exitCode = 1
}

// scripts/lib/stories.mjs
// Shared by the story scripts: export articles for Claude Code to read, then
// validate Claude's drafts and publish them to Supabase.
//
// Drafts never contain story text. Claude gives the exact first and last words
// of each story, and the text is cut from the article here, so a published
// story is always word-for-word what the article says.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

export const ROOT = path.resolve(import.meta.dirname, '..', '..')
export const DATA = path.join(ROOT, 'data')
export const ARTICLES_DIR = path.join(DATA, 'articles')
export const DRAFTS_DIR = path.join(DATA, 'stories')
export const REVIEW_DIR = path.join(DRAFTS_DIR, 'needs-review')
export const PUBLISHED_DIR = path.join(DRAFTS_DIR, 'published')
export const LOG_FILE = path.join(ROOT, 'logs', 'story-pipeline.log')

// --- Supabase ----------------------------------------------------------------

function env(name) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set. Add it to .env.local (see scripts/README.md).`)
    return value
}

// Read-only: the public anon key can only select
export function readClient() {
    return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
        auth: { persistSession: false },
    })
}

// Write: service-role key, used only to publish validated drafts
export function writeClient() {
    return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}

// --- Helpers -----------------------------------------------------------------

export function slugify(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/['‘’`]/g, '') // "HaMe'agel's" -> "hameagels", not "hame-agel-s"
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function articleFileName(article) {
    return `${slugify(article.masechta)}-${article.daf}-${slugify(article.slug || article.id)}.json`
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true })
}

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

function writeJson(file, value) {
    ensureDir(path.dirname(file))
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

export function log(line) {
    const stamped = `${new Date().toISOString()}  ${line}`
    console.log(stamped)
    ensureDir(path.dirname(LOG_FILE))
    fs.appendFileSync(LOG_FILE, stamped + '\n')
}

export function parseArgs(argv = process.argv.slice(2)) {
    const args = {}
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (!a.startsWith('--')) continue
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) { args[key] = next; i++ } else args[key] = true
    }
    return args
}

// --- Export ------------------------------------------------------------------

// Writes one JSON file per article to data/articles/, plus the tags and sages
// already in use (so Claude reuses the same spellings). Returns the count.
// all: include articles already processed. masechta / article: narrow it down.
export async function exportArticles({ all = false, masechta, article: articleId, limit } = {}) {
    const db = readClient()

    let query = db
        .from('articles')
        .select('id, slug, title, masechta, daf, daf_end, summary, content, tags, stories_extracted_at')
        .order('masechta')
        .order('daf')
    if (!all) query = query.is('stories_extracted_at', null)
    if (masechta) query = query.ilike('masechta', masechta)
    if (articleId) query = query.eq('id', articleId)
    if (limit) query = query.limit(Number(limit))

    const { data: articles, error } = await query
    if (error) {
        if (/stories_extracted_at/.test(error.message)) {
            throw new Error('The stories migration has not been applied yet (supabase/migrations/20261011020000_stories.sql).')
        }
        throw new Error(`Could not read articles: ${error.message}`)
    }

    // Start fresh so Claude only sees what needs doing now
    fs.rmSync(ARTICLES_DIR, { recursive: true, force: true })
    ensureDir(ARTICLES_DIR)

    for (const a of articles) {
        writeJson(path.join(ARTICLES_DIR, articleFileName(a)), {
            id: a.id,
            slug: a.slug,
            masechta: a.masechta,
            daf: a.daf,
            daf_end: a.daf_end,
            title: a.title,
            summary: a.summary,
            tags: a.tags ?? [],
            content: a.content ?? '',
        })
    }

    // Vocabulary: tags and sages already used on the site
    const [{ data: tagRows }, { data: storyRows }] = await Promise.all([
        db.from('articles').select('tags'),
        db.from('stories').select('people, tags'),
    ])
    const tags = new Set(readJson(path.join(DATA, 'tag-vocabulary.json'), []))
    const people = new Set(readJson(path.join(DATA, 'people-vocabulary.json'), []))
    for (const r of [...(tagRows ?? []), ...(storyRows ?? [])]) for (const t of r.tags ?? []) if (t?.trim()) tags.add(t.trim())
    for (const r of storyRows ?? []) for (const p of r.people ?? []) if (p?.trim()) people.add(p.trim())
    writeJson(path.join(DATA, 'tag-vocabulary.json'), [...tags].sort((a, b) => a.localeCompare(b)))
    writeJson(path.join(DATA, 'people-vocabulary.json'), [...people].sort((a, b) => a.localeCompare(b)))

    return articles.length
}

// --- Validate ----------------------------------------------------------------

// Finds `needle` in `haystack` ignoring differences in whitespace and quote
// styles. Returns { start, end } in the original string, or null.
function findLoose(haystack, needle, from = 0) {
    const norm = ch => (/[‘’‛`´]/.test(ch) ? "'" : /[“”„]/.test(ch) ? '"' : /[–—]/.test(ch) ? '-' : ch)
    const map = [] // index in normalized text -> index in original
    let flat = ''
    let lastSpace = false
    for (let i = 0; i < haystack.length; i++) {
        const ch = norm(haystack[i])
        if (/\s/.test(ch)) {
            if (lastSpace) continue
            lastSpace = true
            flat += ' '
        } else {
            lastSpace = false
            flat += ch
        }
        map.push(i)
    }
    const target = [...needle.trim()].map(norm).join('').replace(/\s+/g, ' ')
    if (!target) return null

    const fromFlat = map.findIndex(i => i >= from)
    const at = flat.indexOf(target, fromFlat === -1 ? flat.length : fromFlat)
    if (at === -1) return null
    if (flat.indexOf(target, at + 1) !== -1) return { ambiguous: true }
    return { start: map[at], end: map[at + target.length - 1] + 1 }
}

// Checks one draft file against its article. Returns { stories, errors } where
// each story has its verbatim content and offsets filled in.
export function validateDraft(draft, article, vocabulary) {
    const errors = []
    const stories = []
    const content = article.content ?? ''

    if (!Array.isArray(draft.stories)) {
        return { stories, errors: ['"stories" must be an array (use [] if the article has no stories)'] }
    }

    const slugs = new Set()
    draft.stories.forEach((s, i) => {
        const label = `story ${i + 1}${s?.title ? ` ("${s.title}")` : ''}`
        const problems = []

        if (!s?.title?.trim()) problems.push('missing title')
        if (!s?.summary?.trim()) problems.push('missing summary')
        if (!s?.start_text?.trim() || !s?.end_text?.trim()) problems.push('missing start_text / end_text')

        const slug = slugify(s?.slug || s?.title || '')
        if (!slug) problems.push('missing slug')
        else if (slugs.has(slug)) problems.push(`duplicate slug "${slug}"`)
        slugs.add(slug)

        const people = (s?.people ?? []).map(p => String(p).trim()).filter(Boolean)
        const tags = (s?.tags ?? []).map(t => String(t).trim()).filter(Boolean)
        const unknownTags = tags.filter(t => !vocabulary.tags.has(t))
        if (unknownTags.length) problems.push(`tags not in data/tag-vocabulary.json: ${unknownTags.join(', ')}`)

        let start, end
        if (s?.start_text && s?.end_text) {
            const a = findLoose(content, s.start_text)
            if (!a) problems.push('start_text not found in the article')
            else if (a.ambiguous) problems.push('start_text appears more than once in the article; use a longer phrase')
            else {
                const b = findLoose(content, s.end_text, a.start)
                if (!b) problems.push('end_text not found after start_text')
                else if (b.ambiguous) problems.push('end_text appears more than once after start_text; use a longer phrase')
                else { start = a.start; end = b.end }
            }
        }
        if (Number.isInteger(start) && end - start < 80) problems.push('story is too short (under 80 characters)')

        if (problems.length) {
            errors.push(`${label}: ${problems.join('; ')}`)
            return
        }

        stories.push({
            slug,
            title: s.title.trim(),
            summary: s.summary.trim(),
            people,
            tags,
            position: i,
            start_offset: start,
            end_offset: end,
            content: content.slice(start, end),
        })
    })

    return { stories, errors }
}

// --- Publish -----------------------------------------------------------------

function listDrafts(file) {
    if (file) return [path.resolve(file)]
    if (!fs.existsSync(DRAFTS_DIR)) return []
    return fs.readdirSync(DRAFTS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(DRAFTS_DIR, f))
}

function moveTo(dir, file, extra) {
    ensureDir(dir)
    const target = path.join(dir, path.basename(file))
    if (extra) writeJson(target, { ...readJson(file, {}), ...extra })
    else fs.copyFileSync(file, target)
    fs.rmSync(file)
}

// A slug free for this article: keep it if it's ours already, otherwise
// qualify it with the masechta and daf, then number it.
async function claimSlug(db, slug, story, articleId) {
    const candidates = [slug, `${slug}-${slugify(story.masechta)}-${story.daf}`]
    for (let i = 2; candidates.length < 12; i++) candidates.push(`${candidates[1]}-${i}`)
    for (const candidate of candidates) {
        const { data } = await db.from('stories').select('article_id').eq('slug', candidate).maybeSingle()
        if (!data || String(data.article_id) === String(articleId)) return candidate
    }
    throw new Error(`No free slug for "${slug}"`)
}

// Validates every draft in data/stories/ and publishes the good ones.
// Returns { published, stories, review }.
export async function publishDrafts({ dryRun = false, file } = {}) {
    const db = dryRun ? readClient() : writeClient()
    const vocabulary = {
        tags: new Set(readJson(path.join(DATA, 'tag-vocabulary.json'), [])),
    }
    const result = { published: 0, stories: 0, review: 0 }

    for (const draftFile of listDrafts(file)) {
        const name = path.basename(draftFile)
        const draft = readJson(draftFile, null)
        if (!draft?.article_id) {
            log(`${name}: not a valid draft (missing article_id) → needs review`)
            if (!dryRun) moveTo(REVIEW_DIR, draftFile, { _errors: ['missing article_id or invalid JSON'] })
            result.review++
            continue
        }

        const { data: article, error } = await db
            .from('articles')
            .select('id, masechta, daf, content, tags')
            .eq('id', draft.article_id)
            .maybeSingle()
        if (error || !article) {
            log(`${name}: article ${draft.article_id} not found → needs review`)
            if (!dryRun) moveTo(REVIEW_DIR, draftFile, { _errors: [`article ${draft.article_id} not found`] })
            result.review++
            continue
        }

        const { stories, errors } = validateDraft(draft, article, vocabulary)
        if (errors.length) {
            log(`${name}: ${errors.length} problem(s) → needs review\n    ${errors.join('\n    ')}`)
            if (!dryRun) moveTo(REVIEW_DIR, draftFile, { _errors: errors })
            result.review++
            continue
        }

        if (dryRun) {
            log(`${name}: OK, would publish ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}: ${stories.map(s => s.title).join(' | ') || '(none)'}`)
            result.published++
            result.stories += stories.length
            continue
        }

        const rows = []
        for (const s of stories) {
            const row = { ...s, article_id: article.id, masechta: article.masechta, daf: article.daf }
            row.slug = await claimSlug(db, s.slug, row, article.id)
            rows.push(row)
        }

        if (rows.length) {
            const { error: upsertError } = await db.from('stories').upsert(rows, { onConflict: 'slug' })
            if (upsertError) throw new Error(`${name}: ${upsertError.message}`)
        }

        // Re-running extraction replaces the article's stories: drop ones no longer in the draft
        const keep = rows.map(r => r.slug)
        let stale = db.from('stories').delete().eq('article_id', article.id)
        if (keep.length) stale = stale.not('slug', 'in', `(${keep.map(s => `"${s}"`).join(',')})`)
        const { error: deleteError } = await stale
        if (deleteError) throw new Error(`${name}: ${deleteError.message}`)

        // Merge suggested article tags (never removes existing ones)
        const suggested = (draft.article_tags ?? []).map(t => String(t).trim()).filter(t => vocabulary.tags.has(t))
        const tags = [...new Set([...(article.tags ?? []), ...suggested])]
        const { error: articleError } = await db
            .from('articles')
            .update({ stories_extracted_at: new Date().toISOString(), tags })
            .eq('id', article.id)
        if (articleError) throw new Error(`${name}: ${articleError.message}`)

        moveTo(PUBLISHED_DIR, draftFile)
        log(`${name}: published ${rows.length} stor${rows.length === 1 ? 'y' : 'ies'}${rows.length ? `: ${rows.map(r => r.slug).join(', ')}` : ''}`)
        result.published++
        result.stories += rows.length
    }

    return result
}

// Tells the live site to refresh its cached pages (new stories, sitemap, llms.txt)
export async function revalidateSite() {
    const secret = process.env.REVALIDATE_SECRET
    const site = process.env.SITE_URL || 'https://dafyomiinsights.com'
    if (!secret) {
        log('REVALIDATE_SECRET not set: skipped refreshing the site (pages update within the hour anyway)')
        return false
    }
    const res = await fetch(`${site}/api/revalidate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
    })
    log(res.ok ? `Refreshed ${site}` : `Refreshing ${site} failed: HTTP ${res.status}`)
    return res.ok
}

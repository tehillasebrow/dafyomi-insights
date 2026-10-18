// lib/articles.js
// Shared helpers for article URLs, dates and queries. Safe on client and server.
import { supabase } from '@/app/lib/supabase'
import { findMasechta, masechtaSlug } from '@/app/lib/shas'

export function decodeParam(value) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

export function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function dafPath(masechta, daf) {
    return `/daf/${masechtaSlug(masechta)}/${daf}`
}

// A standalone article (tribute, Q&A, magazine piece) has no masechta/daf.
// It lives under /beyond-the-daf instead of a daf page.
export const BEYOND_THE_DAF = 'Beyond the Daf'
export const BEYOND_THE_DAF_PATH = '/beyond-the-daf'

export function isStandalone(article) {
    return !article?.masechta
}

export function articlePath(article) {
    if (isStandalone(article)) return `${BEYOND_THE_DAF_PATH}/${encodeURIComponent(article.slug || article.id)}`
    return `${dafPath(article.masechta, article.daf)}/${encodeURIComponent(article.slug || article.id)}`
}

export function dafLabel(article) {
    return article.daf_end && article.daf_end !== article.daf
        ? `${article.daf}–${article.daf_end}`
        : `${article.daf}`
}

// Where an article sits: "Berachos 12" or "Beyond the Daf"
export function articlePlace(article) {
    return isStandalone(article) ? BEYOND_THE_DAF : `${article.masechta} ${dafLabel(article)}`
}

// Only articles that are about a daf (leaves out Beyond the Daf)
export function onDaf(query) {
    return query.not('masechta', 'is', null)
}

// published_at is the original publication date; older rows may only have created_at
export function articleDate(article) {
    return article.published_at || article.created_at
}

// Dates are formatted in UTC with a fixed locale, so server and browser agree
export function formatArticleDate(article, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
    return new Date(articleDate(article)).toLocaleDateString('en-US', { timeZone: 'UTC', ...options })
}

// Columns for article lists: everything a preview needs, without loading every full article twice
export const ARTICLE_LIST_COLUMNS = 'id, slug, title, summary, content, masechta, daf, daf_end, tags, image_url, published_at, created_at'

// The first lines of the article, for previews. Readers prefer the real opening to the summary;
// the summary is only a fallback for an article with no text.
export function articleOpening(article, max = 240) {
    // Subheadings ("## Title" paragraphs) are left out of the preview
    const text = String(article.content || article.summary || '').replace(/^[ \t]*##[ \t]+.*$/gm, '').replace(/\s+/g, ' ').trim()
    if (text.length <= max) return text
    // End on a full sentence when one finishes late enough; otherwise cut at a word
    const sentence = Math.max(...['. ', '? ', '! '].map(p => text.lastIndexOf(p, max - 1)))
    if (sentence >= max * 0.6) return text.slice(0, sentence + 1)
    const cut = text.lastIndexOf(' ', max - 1)
    return text.slice(0, cut > 0 ? cut : max).replace(/[,;:\-–—\s]+$/, '') + '…'
}

export function readingMinutes(article) {
    const words = String(article.content || '').trim().split(/\s+/).filter(Boolean).length
    return Math.max(1, Math.round(words / 220))
}

// Newest first, by published_at with created_at as the fallback
export function orderByPublished(query) {
    return query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
}

// Articles whose range (daf .. daf_end) includes the given daf
export function coveringDaf(query, daf) {
    return query
        .lte('daf', daf)
        .or(`daf.eq.${daf},daf_end.gte.${daf}`)
}

// All articles covering a daf, newest first: the ones filed under it, then the
// ones that also discuss it (articles.refs). refs use the canonical masechta name.
export async function getArticlesForDaf(masechta, daf, columns = '*') {
    const query = supabase
        .from('articles')
        .select(columns)
        .ilike('masechta', masechta)
    const canonical = findMasechta(masechta)?.name ?? masechta
    const [{ data }, { data: alsoOn }] = await Promise.all([
        orderByPublished(coveringDaf(query, daf)),
        orderByPublished(supabase.from('articles').select(columns).contains('refs', [{ masechta: canonical, daf: Number(daf) }])),
    ])
    const own = data || []
    const ids = new Set(own.map(a => a.id))
    return [...own, ...(alsoOn || []).filter(a => !ids.has(a.id))]
}

// Articles filed under another masechta that also discuss this one (articles.refs)
export async function getArticlesReferencing(masechta, columns = '*') {
    const canonical = findMasechta(masechta)?.name ?? masechta
    const { data } = await orderByPublished(
        supabase.from('articles').select(columns).contains('refs', [{ masechta: canonical }])
    )
    return data || []
}

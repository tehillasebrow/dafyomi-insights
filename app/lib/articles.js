// lib/articles.js
// Shared helpers for article URLs, dates and queries. Safe on client and server.
import { supabase } from '@/app/lib/supabase'

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
    return `/daf/${encodeURIComponent(masechta.toLowerCase())}/${daf}`
}

export function articlePath(article) {
    return `${dafPath(article.masechta, article.daf)}/${encodeURIComponent(article.slug || article.id)}`
}

export function dafLabel(article) {
    return article.daf_end && article.daf_end !== article.daf
        ? `${article.daf}–${article.daf_end}`
        : `${article.daf}`
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

// All articles covering a daf, newest first
export async function getArticlesForDaf(masechta, daf, columns = '*') {
    const query = supabase
        .from('articles')
        .select(columns)
        .ilike('masechta', masechta)
    const { data } = await orderByPublished(coveringDaf(query, daf))
    return data || []
}

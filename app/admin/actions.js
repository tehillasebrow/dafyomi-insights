'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin'
import { checkPassword, createAdminSession, clearAdminSession, isAdmin } from '@/app/lib/adminAuth'
import { slugify, articlePath } from '@/app/lib/articles'
import { postingStatus } from '@/app/lib/shas'
import { logEvent } from '@/app/lib/events'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const NOT_AUTHORIZED = '❌ Not authorized. Please log in again.'

// --- Auth ---

export async function login(prevState, formData) {
    if (!checkPassword(formData.get('password'))) {
        await logEvent('admin_login_failed', { path: '/admin' })
        return { error: '❌ Wrong Access Code' }
    }
    await createAdminSession()
    await logEvent('admin_login', { path: '/admin' })
    revalidatePath('/admin')
    return { error: null }
}

export async function logout() {
    await logEvent('admin_logout', { path: '/admin' })
    await clearAdminSession()
    revalidatePath('/admin')
}

// --- Helpers ---

function text(formData, key) {
    return String(formData.get(key) ?? '').trim()
}

function optionalInt(formData, key) {
    const value = text(formData, key)
    if (!value) return null
    const n = parseInt(value, 10)
    return Number.isInteger(n) ? n : NaN
}

async function uniqueSlug(supabase, masechta, daf, title) {
    const base = slugify(title) || 'article'
    const { data } = await supabase
        .from('articles')
        .select('slug')
        .ilike('masechta', masechta)
        .eq('daf', daf)
        .like('slug', `${base}%`)

    const taken = new Set((data || []).map(a => a.slug))
    if (!taken.has(base)) return base
    let i = 2
    while (taken.has(`${base}-${i}`)) i++
    return `${base}-${i}`
}

async function uploadImage(supabase, file) {
    if (!file || typeof file === 'string' || file.size === 0) return { url: null }
    if (!file.type?.startsWith('image/')) return { error: 'File must be an image' }
    if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be under 8MB' }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage
        .from('images')
        .upload(fileName, file, { contentType: file.type })
    if (error) return { error: error.message }

    const { data } = supabase.storage.from('images').getPublicUrl(fileName)
    return { url: data.publicUrl }
}

// --- Articles ---

export async function createArticle(prevState, formData) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const supabase = getSupabaseAdmin()

    const title = text(formData, 'title')
    const masechta = text(formData, 'masechta')
    const daf = optionalInt(formData, 'daf')
    const dafEnd = optionalInt(formData, 'daf_end')
    const publishedAt = text(formData, 'published_at')

    if (!title || !masechta || !Number.isInteger(daf)) {
        return { error: '❌ Error: Title, Masechta and Daf are required' }
    }
    if (Number.isNaN(dafEnd) || (dafEnd !== null && dafEnd < daf)) {
        return { error: '❌ Error: "Through Daf" must be a number ≥ Daf' }
    }

    const image = await uploadImage(supabase, formData.get('image'))
    if (image.error) return { error: `❌ Image Error: ${image.error}` }

    const article = {
        title,
        masechta,
        daf,
        daf_end: dafEnd,
        summary: text(formData, 'summary'),
        content: text(formData, 'content'),
        slug: await uniqueSlug(supabase, masechta, daf, title),
        tags: text(formData, 'tags').split(',').map(t => t.trim()).filter(Boolean),
        image_url: image.url,
        source: 'manual',
        published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
    }

    const { error } = await supabase.from('articles').insert([article])
    if (error) return { error: `❌ Error: ${error.message}` }

    await logEvent('article_created', {
        path: articlePath(article),
        details: { title, masechta, daf, slug: article.slug, image_url: article.image_url },
    })
    revalidatePath('/', 'layout')
    return { error: null, success: '✅ Article Published!', path: articlePath(article) }
}

// --- Stories ---

function list(formData, key) {
    return text(formData, key).split(',').map(t => t.trim()).filter(Boolean)
}

// Finds the article from its URL, e.g. https://dafyomiinsights.com/daf/pesachim/45/the-slug
async function articleFromUrl(supabase, url) {
    const match = url.match(/\/daf\/([^/]+)\/(\d+)\/([^/?#]+)/)
    if (!match) return null
    const [, rawMasechta, , rawSlug] = match
    const masechta = decodeURIComponent(rawMasechta)
    const slug = decodeURIComponent(rawSlug)
    const columns = 'id, slug, masechta, daf, content'
    const { data: bySlug } = await supabase.from('articles').select(columns).ilike('masechta', masechta).eq('slug', slug).limit(1)
    if (bySlug?.[0]) return bySlug[0]
    const { data: byId } = await supabase.from('articles').select(columns).ilike('masechta', masechta).eq('id', slug).limit(1)
    return byId?.[0] ?? null
}

async function uniqueStorySlug(supabase, title, masechta, daf) {
    const base = slugify(String(title).replace(/['‘’`]/g, '')) || 'story'
    const candidates = [base, `${base}-${slugify(masechta)}-${daf}`]
    for (let i = 2; candidates.length < 20; i++) candidates.push(`${candidates[1]}-${i}`)
    const { data } = await supabase.from('stories').select('slug').in('slug', candidates)
    const taken = new Set((data || []).map(s => s.slug))
    return candidates.find(c => !taken.has(c))
}

export async function createStory(prevState, formData) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const supabase = getSupabaseAdmin()

    const title = text(formData, 'title')
    const summary = text(formData, 'summary')
    const content = text(formData, 'content')
    if (!title || !summary || !content) return { error: '❌ Error: Title, Summary and Story text are required' }

    const article = await articleFromUrl(supabase, text(formData, 'article_url'))
    if (!article) return { error: '❌ Error: Paste the full link to the article this story is from' }

    const slug = await uniqueStorySlug(supabase, title, article.masechta, article.daf)
    if (!slug) return { error: '❌ Error: Could not make a unique link for this title' }

    const { count } = await supabase.from('stories').select('id', { count: 'exact', head: true }).eq('article_id', article.id)
    // If the text is copied from the article, remember where, for the article's jump link
    const start = (article.content || '').indexOf(content)

    const story = {
        slug,
        title,
        summary,
        content,
        article_id: article.id,
        masechta: article.masechta,
        daf: article.daf,
        people: list(formData, 'people'),
        tags: list(formData, 'tags'),
        position: count ?? 0,
        start_offset: start === -1 ? null : start,
        end_offset: start === -1 ? null : start + content.length,
    }

    const { error } = await supabase.from('stories').insert([story])
    if (error) return { error: `❌ Error: ${error.message}` }

    const path = `/stories/${encodeURIComponent(slug)}`
    await logEvent('story_created', { path, details: { title, slug, article_id: article.id } })
    revalidatePath('/', 'layout')
    return { error: null, success: '✅ Story Published!', path }
}

// --- Daily discussions ---

export async function createDailyDiscussion(prevState, formData) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const supabase = getSupabaseAdmin()

    const date = text(formData, 'date')
    const masechta = text(formData, 'masechta')
    const daf = optionalInt(formData, 'daf')

    if (!date || !masechta || !Number.isInteger(daf)) {
        return { error: '❌ Error: Date, Masechta and Daf are required' }
    }

    const { error } = await supabase.from('daily_discussions').insert([{
        date,
        masechta,
        daf,
        topic_summary: text(formData, 'topic_summary'),
    }])
    if (error) return { error: `❌ Error: ${error.message}` }

    await logEvent('daily_created', { path: `/daily/${date}`, details: { date, masechta, daf } })
    revalidatePath('/daily', 'layout')
    return { error: null, success: '✅ Daily Daf Updated!' }
}

// --- Comments ---

const COMMENT_TABLES = { article: 'comments', daily: 'daily_comments' }
const COMMENT_PARENTS = { article: 'article_id', daily: 'daily_id' }

export async function postComment(kind, parentId, author, content) {
    const table = COMMENT_TABLES[kind]
    author = String(author ?? '').trim().slice(0, 100)
    content = String(content ?? '').trim().slice(0, 5000)
    if (!table || !parentId || !author || !content) return { error: 'Name and comment are required' }
    // The discussion is closed from candle-lighting to nightfall on Shabbos and Yom Tov
    if (postingStatus().closed) return { error: 'The discussion is closed on Shabbos and Yom Tov' }

    const { data, error } = await getSupabaseAdmin()
        .from(table)
        .insert([{ [COMMENT_PARENTS[kind]]: parentId, author_name: author, content }])
        .select('id')
        .single()
    if (error) return { error: error.message }

    await logEvent('comment', { details: { kind, comment_id: data.id, parent_id: parentId, author, content } })
    return { error: null }
}

export async function deleteComment(kind, id) {
    if (!(await isAdmin())) return { error: 'Not authorized. Log in at /admin first.' }

    const table = COMMENT_TABLES[kind]
    if (!table || !id) return { error: 'Invalid comment' }

    const supabase = getSupabaseAdmin()
    // Snapshot the comment so the audit log keeps what was deleted
    const { data: existing } = await supabase.from(table).select('*').eq('id', id).maybeSingle()

    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return { error: error.message }

    await logEvent('comment_deleted', { details: { kind, comment: existing } })
    return { error: null }
}

// --- Visitors / audit log ---

export async function getSiteStats(days = 7) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const since = new Date(Date.now() - Math.max(1, Number(days) || 7) * 86400000).toISOString()

    const { data, error } = await getSupabaseAdmin().rpc('site_stats', { since })
    if (error) return { error: error.message }
    return { error: null, stats: data }
}

export async function getSiteEvents({ type = '', visitorId = '', limit = 200 } = {}) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }

    let q = getSupabaseAdmin()
        .from('site_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(limit) || 200, 1000))
    if (type === 'audit') q = q.not('type', 'in', '(page_view,search,search_click)')
    else if (type) q = q.eq('type', type)
    if (visitorId) q = q.eq('visitor_id', visitorId)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { error: null, events: data }
}

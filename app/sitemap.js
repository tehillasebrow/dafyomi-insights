import { supabase } from '@/app/lib/supabase'
import { SITE_URL } from '@/app/lib/site'
import { masechtaHref } from '@/app/lib/shas'
import { articlePath, articleDate, dafPath, BEYOND_THE_DAF_PATH } from '@/app/lib/articles'
import { storyPath, personPath } from '@/app/lib/stories'
import { topicsFor, topicPath, subtopicsFor, subtopicPath } from '@/app/lib/topics'

export const revalidate = 3600

export default async function sitemap() {
    const COLUMNS = 'id, slug, masechta, daf, daf_end, tags, created_at, published_at'
    let [{ data: articles, error }, { data: dailies }, { data: stories }] = await Promise.all([
        supabase.from('articles').select(`${COLUMNS}, refs`),
        supabase.from('daily_discussions').select('date'),
        supabase.from('stories').select('slug, masechta, people, tags, updated_at, article_id'),
    ])
    // Before the article_refs migration there is no refs column
    if (error) ({ data: articles } = await supabase.from('articles').select(COLUMNS))

    const now = new Date()
    const latest = new Map() // path -> most recent article date

    const touch = (path, date) => {
        const d = new Date(date)
        if (!latest.has(path) || latest.get(path) < d) latest.set(path, d)
    }

    for (const a of articles ?? []) {
        // Articles that aren't on a daf freshen /beyond-the-daf instead of a masechta page
        touch(a.masechta ? masechtaHref(a.masechta) : BEYOND_THE_DAF_PATH, articleDate(a))
        // An article also listed under other masechtos (articles.refs) freshens those pages too
        for (const r of a.refs ?? []) if (r?.masechta) touch(masechtaHref(r.masechta), articleDate(a))
        for (const t of topicsFor(a.tags)) touch(topicPath(t), articleDate(a))
        for (const s of subtopicsFor(a.tags)) touch(subtopicPath(s), articleDate(a))
    }
    for (const s of stories ?? []) {
        if (s.masechta) touch(masechtaHref(s.masechta), s.updated_at)
        touch('/stories', s.updated_at)
        touch('/people', s.updated_at)
        for (const name of s.people ?? []) {
            if (name?.trim()) touch(personPath(name.trim()), s.updated_at)
        }
        for (const t of topicsFor(s.tags)) touch(topicPath(t), s.updated_at)
        for (const sub of subtopicsFor(s.tags)) touch(subtopicPath(sub), s.updated_at)
    }

    const staticPages = [
        { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: `${SITE_URL}/daily`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/articles`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        { url: `${SITE_URL}/daily/archive`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
        { url: `${SITE_URL}/masechtos`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/topics`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    ]

    const indexPages = [...latest].map(([path, lastModified]) => ({
        url: `${SITE_URL}${path}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: path.startsWith('/daf/') || path === '/stories' ? 0.7 : path.startsWith('/people') ? 0.6 : 0.5,
    }))

    // A story's date is its article's: the stories were all re-saved on one day, and a
    // sitemap where hundreds of pages share one date teaches Google to ignore the dates
    const articleDates = new Map((articles ?? []).map(a => [a.id, articleDate(a)]))
    const storyPages = (stories ?? []).map(s => ({
        url: `${SITE_URL}${storyPath(s)}`,
        lastModified: new Date(articleDates.get(s.article_id) ?? s.updated_at),
        changeFrequency: 'monthly',
        priority: 0.8,
    }))

    const articlePages = (articles ?? []).map(a => ({
        url: `${SITE_URL}${articlePath(a)}`,
        lastModified: new Date(articleDate(a)),
        changeFrequency: 'monthly',
        priority: 0.8,
    }))

    // A daf with two or more articles has its own list page (a daf with one redirects to the article)
    const onDaf = new Map()
    for (const a of articles ?? []) {
        if (!a.masechta) continue
        for (let d = a.daf; d <= (a.daf_end ?? a.daf); d++) {
            const path = dafPath(a.masechta, d)
            const entry = onDaf.get(path) ?? { count: 0, date: new Date(0) }
            entry.count++
            if (new Date(articleDate(a)) > entry.date) entry.date = new Date(articleDate(a))
            onDaf.set(path, entry)
        }
    }
    const dafPages = [...onDaf].filter(([, e]) => e.count > 1).map(([path, e]) => ({
        url: `${SITE_URL}${path}`,
        lastModified: e.date,
        changeFrequency: 'monthly',
        priority: 0.6,
    }))

    const dailyPages = (dailies ?? []).map(d => ({
        url: `${SITE_URL}/daily/${d.date}`,
        lastModified: new Date(d.date),
        changeFrequency: 'monthly',
        priority: 0.4,
    }))

    return [...staticPages, ...indexPages, ...articlePages, ...dafPages, ...storyPages, ...dailyPages]
}

// lib/stories.js
// Gemara stories pulled out of articles. Each has its own page at /stories/{slug}.
// Every query returns [] / null on error, so pages still render before the
// stories migration has been applied.
import { supabase } from '@/app/lib/supabase'
import { slugify, BEYOND_THE_DAF } from '@/app/lib/articles'

export const STORY_CARD_COLUMNS = 'id, slug, title, summary, masechta, daf, people, tags'

export function storyPath(story) {
    return `/stories/${encodeURIComponent(story.slug)}`
}

// Where a story sits: "Berachos 12", or "Beyond the Daf" for a story from a standalone article
export function storyPlace(story) {
    return story?.masechta ? `${story.masechta} ${story.daf}` : BEYOND_THE_DAF
}

export function personSlug(name) {
    return slugify(String(name).replace(/['‘’`]/g, '')) // "Choni HaMe'agel" -> "choni-hameagel"
}

export function personPath(name) {
    return `/people/${personSlug(name)}`
}

export async function getStoryBySlug(slug) {
    const { data } = await supabase.from('stories').select('*').eq('slug', slug).maybeSingle()
    return data ?? null
}

export async function getStoriesForArticle(articleId, columns = '*') {
    const { data } = await supabase
        .from('stories')
        .select(columns)
        .eq('article_id', articleId)
        .order('position', { ascending: true })
    return data ?? []
}

export async function getStoriesAbout(person, { excludeIds = [], limit = 6, columns = STORY_CARD_COLUMNS } = {}) {
    let query = supabase
        .from('stories')
        .select(columns)
        .contains('people', [person])
        .order('masechta')
        .order('daf')
        .limit(limit + excludeIds.length)
    const { data } = await query
    return (data ?? []).filter(s => !excludeIds.includes(s.id)).slice(0, limit)
}

export async function getStoriesInMasechta(masechta, { excludeIds = [], limit = 6 } = {}) {
    if (!masechta) return []
    const { data } = await supabase
        .from('stories')
        .select(STORY_CARD_COLUMNS)
        .ilike('masechta', masechta)
        .order('daf')
        .order('position')
        .limit(limit + excludeIds.length)
    return (data ?? []).filter(s => !excludeIds.includes(s.id)).slice(0, limit)
}

export async function getStoriesWithTag(tag) {
    const { data } = await supabase
        .from('stories')
        .select(STORY_CARD_COLUMNS)
        .contains('tags', [tag])
        .order('masechta')
        .order('daf')
    return data ?? []
}

export async function getAllStories(columns = STORY_CARD_COLUMNS) {
    const { data } = await supabase
        .from('stories')
        .select(columns)
        .order('masechta')
        .order('daf')
        .order('position')
    return data ?? []
}

// Every sage who appears in a story, with how many stories they're in
export async function getAllPeople() {
    const { data } = await supabase.from('stories').select('people')
    const counts = new Map()
    for (const row of data ?? []) {
        for (const name of row.people ?? []) {
            if (name?.trim()) counts.set(name.trim(), (counts.get(name.trim()) ?? 0) + 1)
        }
    }
    return [...counts]
        .map(([name, count]) => ({ name, count, slug: personSlug(name) }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export async function findPersonBySlug(slug) {
    const people = await getAllPeople()
    return people.find(p => p.slug === slug) ?? null
}

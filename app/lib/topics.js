// lib/topics.js
// The site's one list of topics (data/topics.json). Every tag stored on an
// article or story, including old or misspelled ones, is mapped to its topic
// here, so pages always show clean names and link to /topics/{slug}.
// Each topic can also have subtopics: narrower subjects ("Presidential Autopen")
// stored as tags too, with their own page at /topics/{topic}/{subtopic}.
// Safe on client and server.
import data from '@/data/topics.json'

// "Hilchos Halva&#x27;ah" / "R’ Meir" / "Hakaras Hatov" all reduce to the same key
function key(text) {
    return String(text ?? '')
        .replace(/&#x27;|&#39;|&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
        .toLowerCase()
        .replace(/['‘’`]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export const TOPIC_GROUPS = data.groups

export const TOPICS = data.topics.map(t => {
    const topic = { ...t, slug: key(t.name) }
    topic.subtopics = (t.subtopics ?? []).map(s => ({ ...s, slug: key(s.name), topic }))
    return topic
})

export const SUBTOPICS = TOPICS.flatMap(t => t.subtopics)

const BY_KEY = new Map()
for (const t of TOPICS) {
    for (const name of [t.name, ...(t.aliases ?? [])]) {
        if (!BY_KEY.has(key(name))) BY_KEY.set(key(name), t)
    }
}
const SUB_BY_KEY = new Map()
for (const s of SUBTOPICS) {
    for (const name of [s.name, ...(s.aliases ?? [])]) {
        if (!SUB_BY_KEY.has(key(name))) SUB_BY_KEY.set(key(name), s)
    }
}
const RETIRED = new Set((data.retired ?? []).map(key))

// A topic from its name, any alias, or its slug; null if it isn't a topic
export function findTopic(nameOrSlug) {
    return BY_KEY.get(key(nameOrSlug)) ?? null
}

// A subtopic from its name, alias or slug; with a topic, only that topic's subtopics
export function findSubtopic(nameOrSlug, topic = null) {
    const sub = SUB_BY_KEY.get(key(nameOrSlug)) ?? null
    return sub && (!topic || sub.topic.slug === topic.slug) ? sub : null
}

export function isRetiredTag(tag) {
    return RETIRED.has(key(tag))
}

export function topicPath(topic) {
    return `/topics/${topic.slug}`
}

export function subtopicPath(sub) {
    return `/topics/${sub.topic.slug}/${sub.slug}`
}

// Stored tags -> their topics, without duplicates, in the order given.
// A subtopic tag counts for its topic too.
export function topicsFor(tags = []) {
    const seen = new Set()
    const out = []
    for (const tag of tags ?? []) {
        const topic = findTopic(tag) ?? findSubtopic(tag)?.topic
        if (topic && !seen.has(topic.slug)) {
            seen.add(topic.slug)
            out.push(topic)
        }
    }
    return out
}

// Stored tags -> their subtopics, without duplicates, in the order given
export function subtopicsFor(tags = []) {
    const seen = new Set()
    const out = []
    for (const tag of tags ?? []) {
        const sub = findTopic(tag) ? null : findSubtopic(tag)
        if (sub && !seen.has(sub.topic.slug + '/' + sub.slug)) {
            seen.add(sub.topic.slug + '/' + sub.slug)
            out.push(sub)
        }
    }
    return out
}

function variants(names) {
    return [...new Set(names.flatMap(n => [n, n.replace(/'/g, '&#x27;')]))]
}

// Every stored spelling of a topic (and of its subtopics), for database queries (.overlaps('tags', ...))
export function tagVariants(topic) {
    return variants([topic.name, ...(topic.aliases ?? []), ...(topic.subtopics ?? []).flatMap(s => [s.name, ...(s.aliases ?? [])])])
}

export function subtopicVariants(sub) {
    return variants([sub.name, ...(sub.aliases ?? [])])
}

// Counts per topic from rows with a `tags` array: Map(slug -> count)
export function countTopics(rows = []) {
    const counts = new Map()
    for (const row of rows ?? []) {
        for (const t of topicsFor(row.tags)) counts.set(t.slug, (counts.get(t.slug) ?? 0) + 1)
    }
    return counts
}

// lib/topics.js
// The site's one list of topics (data/topics.json). Every tag stored on an
// article or story, including old or misspelled ones, is mapped to its topic
// here, so pages always show clean names and link to /topics/{slug}.
// Each topic can also have subtopics: narrower subjects ("Presidential Autopen")
// stored as tags too, with their own page at /topics/{topic}/{subtopic}.
// Safe on client and server.
import data from '@/data/topics.json'
import intros from '@/data/topic-intros.json'
import subIntros from '@/data/subtopic-intros.json'

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

// The topic's page heading, worded the way people search: "Anger in the Gemara",
// or the fuller one written with its introduction
const PLAIN_HEADINGS = new Set(['daf-quiz'])
export function topicHeading(topic) {
    if (intros[topic.slug]?.heading) return intros[topic.slug].heading
    return PLAIN_HEADINGS.has(topic.slug) ? topic.name : `${topic.name} in the Gemara`
}

// A subtopic page's heading, in the same spirit, worded so it still reads naturally:
//   "Prohibition of Raising Pigs" -> "Prohibition of Raising Pigs in the Gemara"
//   "Are Pets Muktzeh"            -> "Are Pets Muktzeh?"  (a real question)
//   "Why Chanukah Is Eight Days", "Celebrating Birthdays in Halacha" -> unchanged
const AUX = 'are|is|was|were|do|does|did|can|could|will|would|should|may|might|must'
const QUESTION = new RegExp(`^(?:(?:${AUX})|(?:why|what|how|who|where|when|which)\\s+(?:${AUX}))\\b`, 'i')
const QUESTION_WORD = /^(?:why|what|how|who|where|when|which)\b/i
const NAMES_A_SOURCE = /\b(?:gemara|talmud|halacha|torah|tanach|midrash|chazal|mishnah?|haggadah)\b/i
export function subtopicHeading(sub) {
    const name = sub.name.trim()
    if (/[?!.]$/.test(name)) return name
    if (QUESTION.test(name)) return `${name}?`
    if (QUESTION_WORD.test(name) || NAMES_A_SOURCE.test(name) || PLAIN_HEADINGS.has(sub.topic?.slug)) return name
    return `${name} in the Gemara`
}

// The written introduction for a topic page (data/topic-intros.json), or null.
// intro is paragraphs separated by blank lines; [text](/path) makes a link.
export function topicIntro(topic) {
    return intros[topic.slug] ?? null
}

// A subject page's short introduction (data/subtopic-intros.json, keyed "topic/subject"), or null
export function subtopicIntro(sub) {
    return subIntros[`${sub.topic.slug}/${sub.slug}`] ?? null
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

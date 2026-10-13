// scripts/topics/lib.mjs
// Same mapping as app/lib/topics.js, for scripts: any stored tag (old name,
// alias, odd spelling) -> its topic in data/topics.json, or its subtopic.
import fs from 'node:fs'
import path from 'node:path'

export const TOPICS_FILE = path.resolve(import.meta.dirname, '..', '..', 'data', 'topics.json')

export function key(text) {
    return String(text ?? '')
        .replace(/&#x27;|&#39;|&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
        .toLowerCase()
        .replace(/['‘’`]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function loadTopics() {
    const data = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'))
    const byKey = new Map()
    for (const t of data.topics) for (const n of [t.name, ...(t.aliases ?? [])]) if (!byKey.has(key(n))) byKey.set(key(n), t)
    const subByKey = new Map()
    for (const t of data.topics) for (const s of t.subtopics ?? []) for (const n of [s.name, ...(s.aliases ?? [])]) if (!subByKey.has(key(n))) subByKey.set(key(n), { ...s, topic: t })
    const retired = new Set((data.retired ?? []).map(key))
    return {
        data,
        names: new Set(data.topics.map(t => t.name)),
        find: tag => byKey.get(key(tag)) ?? null,
        findSubtopic: tag => (byKey.has(key(tag)) ? null : subByKey.get(key(tag)) ?? null),
        isRetired: tag => retired.has(key(tag)),
    }
}

// Stored tags -> clean topic names, then subtopic names (deduped; a subtopic
// brings its topic along). Unknown tags are returned separately.
export function cleanTags(tags, topics) {
    const out = []
    const subs = []
    const unknown = []
    for (const tag of tags ?? []) {
        if (!tag?.trim()) continue
        const t = topics.find(tag)
        const s = t ? null : topics.findSubtopic(tag)
        if (t) { if (!out.includes(t.name)) out.push(t.name) }
        else if (s) {
            if (!subs.includes(s.name)) subs.push(s.name)
            if (!out.includes(s.topic.name)) out.push(s.topic.name)
        }
        else if (!topics.isRetired(tag)) unknown.push(tag)
    }
    return { tags: [...out, ...subs], unknown }
}

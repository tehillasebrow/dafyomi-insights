// Checks the topics, other places (refs) and Gemara stories on staged articles
// (data/import/*/articles/*/article.json) before they're published:
//   - every tag is a topic name from data/topics.json (old names are fixed with --fix)
//   - refs point at real masechtos and dafim
//   - every story's start/end text is found exactly once in the article
//   - the same story isn't given its own page twice (same title in two articles)
//   - reviewed articles that still lack tags/refs/stories
// It also collects the new topics and sages the reviewers proposed, so they can be
// added to data/topics.json and data/people-vocabulary.json.
//
//   npm run import:check-seo
//   npm run import:check-seo -- --fix      also rewrites old tag names to topic names
//                                          and drops repeated stories from later articles
import fs from 'node:fs'
import { listStaged, writeJson } from './lib/staging.mjs'
import { validateDraft, topicVocabulary, parseArgs, slugify } from '../lib/stories.mjs'
import { loadTopics, cleanTags } from '../topics/lib.mjs'
import { findMasechta } from '../../app/lib/shas.js'

const args = parseArgs()
const fix = Boolean(args.fix)
const topics = loadTopics()
const vocabulary = topicVocabulary()
const people = new Set(JSON.parse(fs.readFileSync(new URL('../../data/people-vocabulary.json', import.meta.url), 'utf8')))

const problems = []
const missing = []
const proposedTopics = new Map() // name -> { group, count, examples }
const proposedPeople = new Map()
const storyOwners = new Map() // story key -> first folder that has it
let checked = 0, storyCount = 0, fixedFiles = 0

// Oldest first, so a story keeps its page on the earliest article that tells it
const staged = listStaged().sort((a, b) => String(a.article.published_at).localeCompare(String(b.article.published_at)))

for (const { dir, file, article } of staged) {
    const status = article.review?.status || 'pending'
    if (!['approved', 'fixed', 'published'].includes(status)) continue
    checked++
    const name = dir.split(/[\\/]/).slice(-3).join('/')
    let changed = false

    if (!Array.isArray(article.tags) || !('refs' in article) || !Array.isArray(article.stories)) {
        missing.push(name)
    }

    // Tags
    const { tags, unknown } = cleanTags(article.tags, topics)
    if (unknown.length) problems.push(`${name}: tags that aren't topics: ${unknown.join(', ')}`)
    if (JSON.stringify(tags) !== JSON.stringify(article.tags ?? []) && !unknown.length) {
        if (fix) { article.tags = tags; changed = true } else problems.push(`${name}: tags need renaming to topic names (run with --fix)`)
    }

    // Refs
    for (const r of article.refs ?? []) {
        if (!findMasechta(r?.masechta) || !Number.isInteger(Number(r?.daf))) problems.push(`${name}: bad ref ${JSON.stringify(r)}`)
    }

    // Place: a standalone (Beyond the Daf) piece has no masechta, daf or refs; anything else needs a masechta and daf
    if (article.standalone === true) {
        if ((article.refs ?? []).length) problems.push(`${name}: standalone article has refs (should be [])`)
        if (article.masechta || article.daf) problems.push(`${name}: standalone article still has a masechta/daf (should be null)`)
    } else if (!findMasechta(article.masechta) || !Number.isInteger(article.daf)) {
        problems.push(`${name}: no valid masechta/daf (set them, or "standalone": true if it isn't about a daf)`)
    }

    // Stories
    if (Array.isArray(article.stories)) {
        const { stories, errors } = validateDraft({ stories: article.stories }, { content: article.content }, vocabulary)
        for (const e of errors) problems.push(`${name}: ${e}`)
        storyCount += stories.length

        const keep = []
        for (const s of article.stories) {
            const key = slugify(s.slug || s.title || '')
            const first = storyOwners.get(key)
            if (first && first !== name) {
                if (fix) { changed = true; continue }
                problems.push(`${name}: story "${s.title}" already has a page from ${first} (run with --fix to keep only the first)`)
            } else storyOwners.set(key, name)
            keep.push(s)
            for (const p of s.people ?? []) if (!people.has(p)) {
                const e = proposedPeople.get(p) ?? { count: 0 }
                e.count++
                proposedPeople.set(p, e)
            }
        }
        if (fix && keep.length !== article.stories.length) article.stories = keep
    }

    for (const t of article.review?.new_topics ?? []) {
        const n = typeof t === 'string' ? t : t?.name
        if (!n || topics.find(n)) continue
        const e = proposedTopics.get(n) ?? { group: t.group, count: 0, examples: [] }
        e.count++
        if (e.examples.length < 3) e.examples.push(article.title)
        proposedTopics.set(n, e)
    }
    for (const p of article.review?.new_people ?? []) {
        if (people.has(p) || proposedPeople.has(p)) continue
        proposedPeople.set(p, { count: 0 })
    }

    if (changed) { writeJson(file, article); fixedFiles++ }
}

console.log(`Checked ${checked} reviewed articles: ${storyCount} stories.`)
if (fix) console.log(`Fixed ${fixedFiles} file(s).`)
if (missing.length) console.log(`\nStill need topics/refs/stories (${missing.length}):\n  ${missing.join('\n  ')}`)
if (problems.length) console.log(`\nProblems (${problems.length}):\n  ${problems.join('\n  ')}`)
if (proposedTopics.size) {
    console.log(`\nProposed new topics (${proposedTopics.size}), most wanted first:`)
    for (const [n, e] of [...proposedTopics].sort((a, b) => b[1].count - a[1].count)) console.log(`  ${n} [${e.group ?? '?'}] ×${e.count}: ${e.examples.join(' | ')}`)
}
if (proposedPeople.size) console.log(`\nSages not yet in data/people-vocabulary.json (${proposedPeople.size}):\n  ${[...proposedPeople.keys()].sort().join(', ')}`)
if (!missing.length && !problems.length) console.log('\nAll good.')

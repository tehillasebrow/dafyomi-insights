// Cleans the topics already on the site: every article's and story's tags are
// replaced with the matching topic names from data/topics.json (old names and
// aliases are mapped, duplicates merged, citations and people removed).
//
//   npm run topics:apply                 # preview only, changes nothing
//   npm run topics:apply -- --write      # apply the changes
//
// Tags that match no topic are listed so you can add them to data/topics.json
// (as a topic or an alias) or to "retired". They are kept until you decide,
// unless you also pass --drop-unknown.
import { parseArgs, readClient, writeClient, revalidateSite } from '../lib/stories.mjs'
import { loadTopics, cleanTags } from './lib.mjs'

const args = parseArgs()
const write = Boolean(args.write)
const dropUnknown = Boolean(args['drop-unknown'])
const db = write ? writeClient() : readClient()
const topics = loadTopics()

const unknownCount = new Map()
let changed = 0

for (const table of ['articles', 'stories']) {
    const { data: rows, error } = await db.from(table).select('id, title, tags')
    if (error) {
        console.log(`${table}: skipped (${error.message})`)
        continue
    }
    for (const row of rows) {
        const before = row.tags ?? []
        const { tags, unknown } = cleanTags(before, topics)
        for (const u of unknown) unknownCount.set(u, (unknownCount.get(u) ?? 0) + 1)
        const after = dropUnknown ? tags : [...tags, ...unknown]
        if (JSON.stringify(after) === JSON.stringify(before)) continue
        changed++
        console.log(`${table === 'articles' ? 'Article' : 'Story'}: ${row.title}\n    ${JSON.stringify(before)}\n  → ${JSON.stringify(after)}`)
        if (write) {
            const { error: updateError } = await db.from(table).update({ tags: after }).eq('id', row.id)
            if (updateError) console.log(`    FAILED: ${updateError.message}`)
        }
    }
}

if (unknownCount.size) {
    console.log(`\nTags that match no topic (${unknownCount.size}) — add each to data/topics.json as a topic, an alias, or "retired":`)
    for (const [tag, n] of [...unknownCount].sort((a, b) => b[1] - a[1])) console.log(`  ${tag} (${n})`)
}
console.log(`\n${changed} ${changed === 1 ? 'row' : 'rows'} ${write ? 'updated' : 'would change'}.${write ? '' : ' Run with --write to apply.'}`)
if (write && changed) await revalidateSite()

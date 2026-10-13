// Checks data/topics.json: no duplicate names or aliases, every topic in a known
// group, names in the house style. Also prints the list grouped, so it doubles as
// the running list of topics.
//
//   npm run topics:check
import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve(import.meta.dirname, '..', '..', 'data', 'topics.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

const key = s => String(s).replace(/&#x27;/gi, "'").toLowerCase().replace(/['‘’`]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const problems = []
const owner = new Map() // key -> "topic name (as name|alias)"

for (const t of data.topics) {
    if (!data.groups.includes(t.group)) problems.push(`"${t.name}": unknown group "${t.group}"`)
    if (!t.description || t.description.length < 30) problems.push(`"${t.name}": needs a description (one sentence for the topic page)`)
    if (/&/.test(t.name)) problems.push(`"${t.name}": use "and", not "&"`)
    if (t.name.split(/\s+/).length > 5) problems.push(`"${t.name}": too long (up to 5 words)`)
    if (/\d/.test(t.name)) problems.push(`"${t.name}": looks like a citation`)
    const small = new Set(['and', 'of', 'the', 'in', 'on', 'for', 'to'])
    if (t.name.split(/\s+/).some((w, i) => /^[a-z]/.test(w) && (i === 0 || !small.has(w)))) problems.push(`"${t.name}": use Title Case`)
    for (const [i, name] of [t.name, ...(t.aliases ?? [])].entries()) {
        const k = key(name)
        const label = `${t.name} (${i === 0 ? 'name' : `alias "${name}"`})`
        if (owner.has(k) && !owner.get(k).startsWith(`${t.name} `)) problems.push(`"${name}" is used twice: ${owner.get(k)} and ${label}`)
        else owner.set(k, label)
    }
}
for (const r of data.retired ?? []) {
    if (owner.has(key(r))) problems.push(`retired tag "${r}" is also ${owner.get(key(r))}`)
}

for (const g of data.groups) {
    const list = data.topics.filter(t => t.group === g).map(t => t.name)
    console.log(`${g} (${list.length}): ${list.join(', ')}`)
}
console.log(`\n${data.topics.length} topics, ${owner.size - data.topics.length} aliases, ${(data.retired ?? []).length} retired tags`)

if (problems.length) {
    console.log(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
    process.exitCode = 1
} else {
    console.log('No duplicates. All good.')
}

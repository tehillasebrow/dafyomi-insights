// scripts/photos/find.mjs
// Searches Wikimedia Commons and Openverse for free-license photos for one article and
// makes a numbered contact sheet to look at.
//
//   npm run photos:find -- <folder> "seder plate" ["matzah" ...]
//
// Writes data/photos/candidates/<folder>.json and <folder>.jpg (the sheet). Pick one
// with `npm run photos:pick -- <folder> <number>`.
import fs from 'node:fs'
import path from 'node:path'
import { PHOTOS_DIR, findFolder, searchCommons, searchOpenverse, contactSheet, writeJson } from './lib.mjs'

const [key, ...queries] = process.argv.slice(2)
if (!key || !queries.length) {
    console.error('usage: npm run photos:find -- <folder> "search words" ["more words" ...]')
    process.exit(1)
}
const { article } = findFolder(key)

const seen = new Set()
const candidates = []
for (const q of queries) {
    const results = await Promise.allSettled([searchCommons(q, 16), searchOpenverse(q, 12)])
    for (const r of results) {
        if (r.status === 'rejected') {
            console.error(`  search failed for "${q}": ${r.reason.message}`)
            continue
        }
        for (const c of r.value) {
            if (seen.has(c.full)) continue
            seen.add(c.full)
            candidates.push({ ...c, query: q })
        }
    }
}
const shown = candidates.slice(0, 24)

const dir = path.join(PHOTOS_DIR, 'candidates')
fs.mkdirSync(dir, { recursive: true })
writeJson(path.join(dir, `${key}.json`), shown)
const sheet = path.join(dir, `${key}.jpg`)
if (shown.length) await contactSheet(shown, sheet)
console.log(`"${article.title}": ${shown.length} candidate(s)${shown.length ? `, sheet: ${sheet}` : ''}`)
for (const [i, c] of shown.entries()) console.log(`  ${i}  ${c.provider}  ${c.width ?? '?'}x${c.height ?? '?'}  ${c.license}  ${c.title?.slice(0, 70)}`)

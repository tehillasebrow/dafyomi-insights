// Lists the columns that were printed more than once (the same text under two titles,
// in one paper or both), side by side, for the site owner to decide what to keep.
//
//   npm run import:repeats
//
// Writes data/import/repeats.html (open in a browser: the two versions next to each other,
// with the parts that differ highlighted) and data/import/repeats.csv (opens in Excel, with
// an empty "decision" column to fill in: keep both / keep left / keep right / not a repeat).
import fs from 'node:fs'
import path from 'node:path'
import { IMPORT_DIR, ROOT, listStaged, findSimilar } from './lib/staging.mjs'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const rel = file => path.relative(IMPORT_DIR, file).split(path.sep).join('/')
const norm = w => w.toLowerCase().replace(/[^a-z0-9]/g, '')

// The text as HTML paragraphs, with words that aren't in the other version highlighted.
// A word counts as shared when it's part of a 3-word run that also appears in the other text.
function marked(text, other) {
    const otherWords = other.split(/\s+/).map(norm).filter(Boolean)
    const grams = new Set()
    for (let i = 0; i + 3 <= otherWords.length; i++) grams.add(otherWords.slice(i, i + 3).join(' '))

    const paragraphs = text.split(/\n\n/).map(p => p.split(/\s+/).filter(Boolean))
    const flat = paragraphs.flat()
    const plain = flat.map(norm)
    const shared = new Array(flat.length).fill(false)
    for (let i = 0; i + 3 <= flat.length; i++) {
        if (grams.has(plain.slice(i, i + 3).join(' '))) shared[i] = shared[i + 1] = shared[i + 2] = true
    }

    let at = 0
    return paragraphs
        .map(words => {
            let out = ''
            let open = false
            for (const word of words) {
                const diff = !shared[at++] && plain[at - 1]
                if (diff && !open) (out += '<mark>'), (open = true)
                if (!diff && open) (out += '</mark>'), (open = false)
                out += esc(word) + ' '
            }
            return `<p>${out.trim()}${open ? '</mark>' : ''}</p>`
        })
        .join('\n')
}

// Rejected ones are out already (not his, or a second copy of the same printing)
const rows = listStaged().filter(r => r.article.review?.status !== 'rejected')
const byDir = new Map(rows.map(r => [r.dir, r]))
const similar = findSimilar(rows)

// Group into pairs (and larger groups if a column ran three times)
const seen = new Set()
const pairs = []
for (const [dir, list] of similar) {
    for (const s of list) {
        const key = [dir, s.dir].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        const [a, b] = [byDir.get(dir), byDir.get(s.dir)].sort((x, y) => x.article.published_at.localeCompare(y.article.published_at))
        pairs.push({ a, b, overlap: s.overlap })
    }
}
pairs.sort((x, y) => x.a.article.published_at.localeCompare(y.a.article.published_at))

const side = (r, other) => `
  <div class="side">
    <p class="meta">${esc(r.article.source === '5tjt' ? '5 Towns Jewish Times' : 'The Jewish Home')} · ${esc(r.article.published_at.slice(0, 10))} · ${r.article.standalone ? 'Beyond the Daf' : `${esc(r.article.masechta)} ${esc(r.article.daf)}`} · ${esc(r.article.words)} words · review: ${esc(r.article.review?.status || 'pending')}</p>
    <h2>${esc(r.article.title)}</h2>
    ${r.article.photo && fs.existsSync(path.join(r.dir, r.article.photo)) ? `<img src="${esc(rel(path.join(r.dir, r.article.photo)))}" alt="">` : '<p class="nophoto">No photo</p>'}
    <div class="text">${marked(r.article.content, other.article.content)}</div>
    <p class="meta"><a href="${esc(r.article.source_url)}" target="_blank">Source</a> · ${esc(path.relative(ROOT, r.dir))}</p>
  </div>`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Repeated Columns</title>
<style>
:root { --paper:#f5f5f2; --sunk:#e8e7e1; --ink:#121317; --soft:#45474e; --rule:#bfbeb6; --mark:#ffe9a8; }
* { box-sizing:border-box; }
body { margin:0; padding:24px; background:var(--paper); color:var(--ink); font-family:Georgia, serif; }
h1 { margin:0 0 4px; } .intro { color:var(--soft); max-width:760px; }
.pair { border-top:2px solid var(--ink); margin-top:32px; padding-top:12px; }
.pair h3 { margin:0 0 12px; font-size:18px; }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.side { background:#fff; border:1px solid var(--rule); padding:16px; min-width:0; }
.side h2 { font-size:22px; margin:4px 0 12px; }
.side img { width:100%; height:auto; margin-bottom:12px; }
.meta { font-size:13px; color:var(--soft); margin:0; word-break:break-all; }
.text { font-size:16px; line-height:1.55; max-height:70vh; overflow:auto; }
mark { background:var(--mark); }
.nophoto { color:var(--soft); font-style:italic; }
@media (max-width:900px) { .cols { grid-template-columns:1fr; } body { padding:16px; } }
</style>
</head>
<body>
<h1>Repeated columns: ${pairs.length} pairs</h1>
<p class="intro">Each pair is the same column printed twice, sometimes years apart and under a new title. <mark>Highlighted</mark> words appear in only one of the two versions. Decide for each pair: keep both, keep only one, or not a repeat. Write it in the "decision" column of <b>repeats.csv</b> (opens in Excel), or just tell Claude.</p>
${pairs
    .map(
        (p, i) => `<section class="pair"><h3>${i + 1}. ${Math.round(p.overlap * 100)}% the same text</h3><div class="cols">${side(p.a, p.b)}${side(p.b, p.a)}</div></section>`
    )
    .join('\n')}
</body>
</html>
`

const csvCell = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = [
    ['pair', 'same_text', 'decision', 'left_date', 'left_paper', 'left_title', 'right_date', 'right_paper', 'right_title', 'left_folder', 'right_folder'],
    ...pairs.map((p, i) => [
        i + 1,
        `${Math.round(p.overlap * 100)}%`,
        '',
        p.a.article.published_at.slice(0, 10),
        p.a.article.source,
        p.a.article.title,
        p.b.article.published_at.slice(0, 10),
        p.b.article.source,
        p.b.article.title,
        path.relative(ROOT, p.a.dir),
        path.relative(ROOT, p.b.dir),
    ]),
]
    .map(r => r.map(csvCell).join(','))
    .join('\r\n')

fs.writeFileSync(path.join(IMPORT_DIR, 'repeats.html'), html)
fs.writeFileSync(path.join(IMPORT_DIR, 'repeats.csv'), '﻿' + csv + '\r\n')
console.log(`${pairs.length} repeated pairs: ${path.join(IMPORT_DIR, 'repeats.html')} and repeats.csv`)

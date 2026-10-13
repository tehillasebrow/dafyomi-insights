// Builds data/import/preview.html: every staged article laid out the way the site
// shows it, next to the newspaper page it came from. Open the file in a browser.
//
//   npm run import:preview
//   npm run import:preview -- --check     only articles that need a look
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from '../lib/stories.mjs'
import { IMPORT_DIR, listStaged, seriousWarnings, findSimilar, similarWarning } from './lib/staging.mjs'

const OUT = path.join(IMPORT_DIR, 'preview.html')
const args = parseArgs()

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const rel = file => path.relative(IMPORT_DIR, file).split(path.sep).join('/')
const formatDate = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })

function body(content) {
    return content
        .split(/\n[ \t]*\n+/)
        .filter(p => p.trim())
        .map(p => (p.startsWith('## ') ? `<h2>${esc(p.slice(3))}</h2>` : `<p>${esc(p)}</p>`))
        .join('\n')
}

let items = listStaged().reverse()
if (args.check) items = items.filter(({ article }) => (article.warnings || []).length && article.review?.status === 'pending')

const list = []
const articles = []
const similar = findSimilar()
items.forEach(({ dir, article }, i) => {
    const a = { ...article, warnings: [...(article.warnings || []), ...similarWarning(similar.get(dir) || [])] }
    const serious = seriousWarnings(a)
    const status = a.review?.status || 'pending'
    const flag = serious.length ? 'serious' : (a.warnings || []).length ? 'note' : 'ok'
    list.push(`<li><a href="#a${i}" class="${flag}"><span class="d">${esc(a.published_at.slice(0, 10))}</span> ${esc(a.title)}<span class="s ${esc(status)}">${esc(status)}</span></a></li>`)
    const photo = a.photo && fs.existsSync(path.join(dir, a.photo)) ? `<img class="photo" src="${esc(rel(path.join(dir, a.photo)))}" alt="">` : '<div class="nophoto">No photo</div>'
    const page = fs.existsSync(path.join(dir, 'page.jpg')) ? `<a href="${esc(rel(path.join(dir, 'page.jpg')))}" target="_blank"><img src="${esc(rel(path.join(dir, 'page.jpg')))}" alt="Newspaper page" loading="lazy"></a>` : ''
    articles.push(`
<section id="a${i}" class="article">
  ${a.warnings?.length ? `<ul class="warnings">${a.warnings.map(w => `<li class="${serious.includes(w) ? 'serious' : ''}">${esc(w)}</li>`).join('')}</ul>` : ''}
  <div class="cols">
    <article>
      <p class="kicker">${a.standalone ? 'Beyond the Daf' : `${esc(a.masechta)} ${esc(a.daf)}`} · ${esc(formatDate(a.published_at))} · ${esc(a.words)} words</p>
      <h1>${esc(a.title)}</h1>
      <p class="byline">By Rabbi Avrohom Sebrow</p>
      ${photo}
      <div class="text">${body(a.content)}</div>
      <p class="meta">Source: <a href="${esc(a.source_url)}" target="_blank">${esc(a.source_url)}</a><br>Folder: ${esc(path.relative(path.resolve(IMPORT_DIR, '..', '..'), dir))}</p>
    </article>
    <aside class="paper">${page}</aside>
  </div>
</section>`)
})

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Import Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
<style>
:root { --paper:#f5f5f2; --sunk:#e8e7e1; --ink:#121317; --soft:#45474e; --rule:#bfbeb6; --foil:#7a5b12; --bad:#a3271b; --note:#8a6a12; --good:#2f6b3a; }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font-family:Newsreader, Georgia, serif; display:grid; grid-template-columns: 320px 1fr; }
nav { position:sticky; top:0; height:100vh; overflow:auto; border-right:1px solid var(--rule); background:var(--sunk); padding:16px; }
nav h2 { font-size:15px; margin:0 0 8px; }
nav ul { list-style:none; margin:0; padding:0; font-size:14px; }
nav a { display:block; padding:6px 8px; border-left:4px solid transparent; color:var(--ink); text-decoration:none; }
nav a:hover { background:var(--paper); }
nav a.serious { border-color:var(--bad); } nav a.note { border-color:var(--note); } nav a.ok { border-color:var(--good); }
nav .d { color:var(--soft); font-size:12px; display:block; }
nav .s { float:right; font-size:11px; text-transform:uppercase; color:var(--soft); }
main { padding:24px; min-width:0; }
.article { border-bottom:2px solid var(--ink); padding:24px 0 48px; }
.cols { display:grid; grid-template-columns: minmax(0, 680px) minmax(0, 1fr); gap:32px; }
.kicker { font-size:14px; letter-spacing:.04em; text-transform:uppercase; color:var(--foil); margin:0; }
h1 { font-size:42px; line-height:1.1; margin:8px 0; font-weight:600; }
.byline { color:var(--soft); margin:0 0 16px; }
.photo { width:100%; height:auto; display:block; margin:0 0 20px; }
.nophoto { padding:40px; text-align:center; background:var(--sunk); color:var(--bad); margin-bottom:20px; }
.text { font-size:20px; line-height:1.6; }
.text p { margin:0 0 1em; }
.text h2 { font-size:1.45em; font-weight:600; border-top:1px solid var(--rule); padding-top:.6em; margin:1.4em 0 .5em; }
.meta { font-size:13px; color:var(--soft); word-break:break-all; }
.paper img { width:100%; height:auto; border:1px solid var(--rule); position:sticky; top:16px; }
.warnings { background:#fff7e0; border:1px solid var(--note); padding:10px 10px 10px 28px; margin:0 0 16px; font-size:15px; }
.warnings .serious { color:var(--bad); font-weight:600; }
@media (max-width: 900px) { body { grid-template-columns:1fr; } nav { position:static; height:auto; max-height:40vh; } .cols { grid-template-columns:1fr; } main { padding:16px; } h1 { font-size:32px; } }
</style>
</head>
<body>
<nav><h2>${items.length} articles</h2><p style="font-size:13px;margin:0 0 8px">Red: held for a check · Gold: note · Green: clean</p><ul>${list.join('')}</ul></nav>
<main>${articles.join('\n') || '<p>No staged articles.</p>'}</main>
</body>
</html>
`
fs.mkdirSync(IMPORT_DIR, { recursive: true })
fs.writeFileSync(OUT, html)
console.log(`Preview: ${OUT} (${items.length} articles). Open it in a browser.`)

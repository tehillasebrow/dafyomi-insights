// scripts/photos/review.mjs
// A page to look over every picture change before it goes live: what the site shows
// now next to what it will show, with a box to tick for any the site owner doesn't like.
//
//   npm run photos:review      writes data/photos/review.html (open it in a browser;
//                              its "Copy my notes" button gives the list to paste back)
import fs from 'node:fs'
import path from 'node:path'
import { readClient } from '../lib/stories.mjs'
import { PHOTOS_DIR, articleFolders } from './lib.mjs'

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const rel = file => path.relative(PHOTOS_DIR, file).split(path.sep).join('/')

// What the site shows now
const db = readClient()
const { data: live, error } = await db.from('articles').select('id, source_url, image_url')
if (error) throw error
const liveUrl = a => live.find(r => (a.source_url ? r.source_url === a.source_url : r.id === a.id))?.image_url

const changed = articleFolders()
    .filter(f => f.article.review?.status === 'published' && f.article.photo_changed)
    .map(f => {
        const a = f.article
        const kind = a.photo !== 'stock.jpg' ? 'sharpened' : a.photo_alt ? 'swapped' : a.photo_credit ? 'new' : 'yours'
        return { ...f, kind }
    })
const GROUPS = [
    ['new', 'New photo for an article that had none (it showed a plain title card)'],
    ['yours', 'Your own photo'],
    ['swapped', 'Sharper photo you chose instead of the newspaper\'s'],
    ['sharpened', 'Newspaper photo, AI-sharpened'],
]

const row = ({ key, dir, article: a, kind }) => {
    const now = liveUrl(a)
    const credit = a.photo_credit ? `${esc(a.photo_credit.author)} · ${esc(a.photo_credit.license)}` : ''
    return `<section data-key="${esc(key)}"><h3>${esc(a.title)}</h3>
<div class="pair"><figure>${now ? `<img loading="lazy" src="${esc(now)}">` : '<div class="none">No picture</div>'}<figcaption>Now on the site</figcaption></figure>
<figure><img loading="lazy" src="${esc(rel(path.join(dir, a.photo)))}"><figcaption>New${kind === 'new' || kind === 'swapped' ? ` <small>${credit}</small>` : ''}</figcaption></figure></div>
<label class="no"><input type="checkbox"> I don't like the new one</label> <input class="note" placeholder="what to show instead (optional)"></section>`
}

const body = GROUPS.map(([kind, heading]) => {
    const rows = changed.filter(c => c.kind === kind).sort((x, y) => x.key.localeCompare(y.key))
    return rows.length ? `<h2>${heading} (${rows.length})</h2>${rows.map(row).join('\n')}` : ''
}).join('\n')

fs.writeFileSync(path.join(PHOTOS_DIR, 'review.html'), `<!doctype html><meta charset="utf-8"><title>Review new pictures</title>
<style>body{font:16px Georgia,serif;margin:24px auto;max-width:1100px;padding:0 16px 80px;background:#f5f5f2;color:#1c1e23}
h2{margin-top:36px;border-bottom:2px solid #c8a24a;padding-bottom:4px}section{background:#fff;border:1px solid #ddd;padding:12px 16px;margin:0 0 16px}
section:has(.no input:checked){border:3px solid #b3261e;background:#fdf3f2}h3{margin:2px 0 10px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0}img,.none{width:100%;aspect-ratio:3/2;object-fit:contain;background:#222;display:block}.none{display:grid;place-items:center;color:#aaa}
figcaption{font-size:14px;margin-top:4px}small{color:#666}.no{display:inline-block;margin-top:10px;cursor:pointer}.note{font:inherit;width:55%;margin-left:12px;padding:4px 6px}
#bar{position:fixed;left:0;right:0;bottom:0;background:#1c1e23;color:#f1eee5;padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center}
button{font:inherit;padding:8px 16px;background:#c8a24a;border:0;cursor:pointer}</style>
<h1>Review every picture change (${changed.length})</h1>
<p>Left: what the site shows now. Right: what it will show. Tick <b>I don't like the new one</b> for any you want changed (add a note if you have an idea), then press <b>Copy my notes</b> and paste it to Claude. Nothing goes live until you say so.</p>
${body}
<div id="bar"><span id="count"></span><button id="copy">Copy my notes</button></div>
<script>
const KEY='photo-review';const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}})();
for(const s of document.querySelectorAll('section')){const v=saved[s.dataset.key];if(v){s.querySelector('.no input').checked=v.no;s.querySelector('.note').value=v.note||''}}
const picked=()=>[...document.querySelectorAll('section')].filter(s=>s.querySelector('.no input').checked||s.querySelector('.note').value.trim());
const update=()=>{const o={};for(const s of document.querySelectorAll('section'))o[s.dataset.key]={no:s.querySelector('.no input').checked,note:s.querySelector('.note').value};try{localStorage.setItem(KEY,JSON.stringify(o))}catch{};document.getElementById('count').textContent=picked().length+' marked'};
document.addEventListener('input',update);document.addEventListener('change',update);update();
document.getElementById('copy').onclick=async()=>{const lines=picked().map(s=>'- '+s.dataset.key+' ('+s.querySelector('h3').textContent+')'+(s.querySelector('.note').value.trim()?': '+s.querySelector('.note').value.trim():''));const t=lines.length?'Pictures I don\\'t like:\\n'+lines.join('\\n'):'I like all the pictures.';try{await navigator.clipboard.writeText(t);document.getElementById('copy').textContent='Copied!'}catch{prompt('Copy this:',t)}};
</script>`)
console.log(`${changed.length} change(s): ${path.join(PHOTOS_DIR, 'review.html')}`)

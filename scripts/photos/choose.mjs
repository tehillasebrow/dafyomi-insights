// scripts/photos/choose.mjs
// Lets the site owner choose, article by article, between the newspaper's own (small)
// photo and a sharper free-license alternative found with `photos:pick -- <folder> <n> --alt`.
//
//   npm run photos:choose                     writes data/photos/choose.html (open it in a browser;
//                                             its "Copy my choices" button gives the list to paste back)
//   npm run photos:choose -- --use <folder> [<folder> ...]
//                                             switches those articles to their alternative
import fs from 'node:fs'
import path from 'node:path'
import { PHOTOS_DIR, STOCK, articleFolders, findFolder, writeJson } from './lib.mjs'

const args = process.argv.slice(2)
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const rel = file => path.relative(PHOTOS_DIR, file).split(path.sep).join('/')

if (args[0] === '--use') {
    for (const key of args.slice(1)) {
        const { dir, file, article } = findFolder(key)
        if (!article.photo_alt) {
            console.error(`${key}: no alternative saved`)
            continue
        }
        fs.copyFileSync(path.join(dir, article.photo_alt.file), path.join(dir, STOCK))
        writeJson(file, { ...article, photo: STOCK, photo_credit: article.photo_alt.credit, photo_changed: true })
        console.log(`${key}: now uses the alternative`)
    }
    process.exit(0)
}

const rows = articleFolders()
    .filter(f => f.article.photo_alt && f.article.photo !== STOCK)
    .sort((a, b) => a.key.localeCompare(b.key))
const row = ({ key, dir, article: a }) => `<section data-key="${esc(key)}"><h3>${esc(a.title)}</h3>
<div class="pair"><label><input type="radio" name="${esc(key)}" value="keep" checked><img loading="lazy" src="${esc(rel(path.join(dir, a.photo)))}"><span>Keep the newspaper's photo</span></label>
<label><input type="radio" name="${esc(key)}" value="use"><img loading="lazy" src="${esc(rel(path.join(dir, a.photo_alt.file)))}"><span>Use this sharper photo<small> · ${esc(a.photo_alt.credit?.author)} · ${esc(a.photo_alt.credit?.license)}</small></span></label></div></section>`

fs.writeFileSync(path.join(PHOTOS_DIR, 'choose.html'), `<!doctype html><meta charset="utf-8"><title>Choose photos</title>
<style>body{font:16px Georgia,serif;margin:24px auto;max-width:1100px;padding:0 16px;background:#f5f5f2;color:#1c1e23}
section{background:#fff;border:1px solid #ddd;padding:12px 16px;margin:0 0 18px}h3{margin:4px 0 10px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{cursor:pointer;border:3px solid transparent;padding:4px;display:block}
label:has(input:checked){border-color:#c8a24a;background:#fbf7ec}input{margin-right:6px}img{width:100%;aspect-ratio:3/2;object-fit:contain;background:#222;display:block;margin-bottom:6px}
small{color:#666}#bar{position:sticky;bottom:0;background:#1c1e23;color:#f1eee5;padding:12px 16px;display:flex;gap:12px;align-items:center}
button{font:inherit;padding:8px 16px;background:#c8a24a;border:0;cursor:pointer}</style>
<h1>Choose: newspaper photo or sharper photo</h1>
<p>${rows.length} articles. For each one, click the picture you want on the site. When you're done, press <b>Copy my choices</b> and paste it to Claude.</p>
${rows.map(row).join('\n')}
<div id="bar"><span id="count"></span><button id="copy">Copy my choices</button></div>
<script>
const KEY='photo-choices';const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}})();
for(const [k,v] of Object.entries(saved)){const i=document.querySelector('input[name="'+CSS.escape(k)+'"][value="'+v+'"]');if(i)i.checked=true}
const use=()=>[...document.querySelectorAll('input[value=use]:checked')].map(i=>i.name);
const update=()=>{document.getElementById('count').textContent=use().length+' switched to the sharper photo';const o={};for(const i of document.querySelectorAll('input:checked'))o[i.name]=i.value;try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}};
document.addEventListener('change',update);update();
document.getElementById('copy').onclick=async()=>{const t='Photo choices - use the sharper photo for: '+(use().join(' ')||'(none)');try{await navigator.clipboard.writeText(t);document.getElementById('copy').textContent='Copied!'}catch{prompt('Copy this:',t)}};
</script>`)
console.log(`${rows.length} article(s) to choose: ${path.join(PHOTOS_DIR, 'choose.html')}`)

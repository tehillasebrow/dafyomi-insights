// Builds data/import/decisions.html: everything the site owner needs to decide or
// look at before the backfill is published, collected from the reviewers' notes.
// Safe to re-run any time (e.g. after more articles are reviewed).
//
//   npm run import:decisions
import fs from 'node:fs'
import path from 'node:path'
import { listStaged, IMPORT_DIR } from './lib/staging.mjs'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const items = listStaged().map(({ dir, article }) => ({ dir, a: article, id: dir.split(/[\\/]/).slice(-3).join('/'), notes: article.review?.notes ?? '' }))
const status = x => x.a.review?.status || 'pending'
const reviewed = items.filter(x => ['approved', 'fixed'].includes(status(x)))
const date = x => String(x.a.published_at ?? '').slice(0, 10)
const label = x => `${date(x)} · <b>${esc(x.a.title)}</b> <span class="m">(${x.a.standalone ? 'Beyond the Daf' : `${esc(x.a.masechta)} ${esc(x.a.daf)}${x.a.daf_end ? `–${esc(x.a.daf_end)}` : ''}`}) · ${esc(x.id.split('/')[0])}</span>`
const noteLine = x => x.notes ? `<div class="n">${esc(x.notes)}</div>` : ''

const sections = [
    {
        title: 'Rejected articles',
        why: 'Not published. Usually not his column, a duplicate copy, or not a daf piece. If one should go up after all, tell Claude.',
        list: items.filter(x => status(x) === 'rejected' && !x.a.review?.reprint_of),
    },
    {
        title: 'Older copies of reprinted columns (left out)',
        why: 'Your rule: only the most recent copy is published. Its stories, topics and dafim moved to the newer copy. Tell Claude if one should go up after all.',
        list: items.filter(x => x.a.review?.reprint_of),
    },
    {
        title: 'Daf chosen by the reviewer',
        why: 'The reviewer set or changed the masechta/daf. Most cite it in the text; check the ones that say the article names no daf, or "confirm".',
        list: reviewed.filter(x => /please confirm|confirm the daf|a guess|guessed|no daf (is )?(named|cited|given)|names no daf|cites no daf|doesn.t (name|cite|give) (a|any|the) daf|not sure of the daf|may prefer|issue-date daf|keeps? the issue/i.test(x.notes)),
    },
    {
        title: 'Photos that were wrong or badly cropped',
        why: 'No picture will show. The note says which picture it should be, when known.',
        list: reviewed.filter(x => /photo[^.]*(set to null|was (an? )?(ad|logo|the column logo)|wrong|should be|cropped|is (an? )?ad)/i.test(x.notes)),
    },
    {
        title: 'Not really a daf column',
        why: 'His writing, but a tribute, exhibit write-up, puzzle or notice. Decide whether it belongs on the site.',
        list: reviewed.filter(x => /not a daf column|exhibit|tribute|isn.t about (a|any) daf|puzzle|apology|notice/i.test(x.notes)),
    },
    {
        title: 'Held back for now',
        why: 'Your decision: an older copy whose newer reprint is still being reviewed. It is set aside automatically once the newer copy is reviewed.',
        list: items.filter(x => status(x) === 'held'),
    },
    {
        title: 'Still waiting for review',
        why: 'Not ready to publish yet (another chat is reviewing these).',
        list: items.filter(x => status(x) === 'pending'),
        brief: true,
    },
]

const counts = {
    total: items.length,
    reviewed: reviewed.length,
    rejected: items.filter(x => status(x) === 'rejected').length,
    pending: items.filter(x => status(x) === 'pending').length,
    stories: reviewed.reduce((n, x) => n + (x.a.stories?.length ?? 0), 0),
}

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Backfill decisions</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#1c1e23;background:#f5f5f2}
h1{margin:.2em 0}h2{margin-top:2em;border-bottom:2px solid #c8a24a;padding-bottom:4px}
.why{color:#555}.m{color:#777;font-size:.9em}.n{color:#444;font-size:.92em;margin:2px 0 0 26px}
li{margin:.6em 0;list-style:none}label{cursor:pointer}input{margin-right:8px}
.box{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 16px}
</style>
<h1>Backfill decisions</h1>
<p class="box">${counts.total} staged articles: <b>${counts.reviewed}</b> reviewed and ready, ${counts.rejected} rejected, ${counts.pending} still being reviewed. ${counts.stories} Gemara stories will get their own pages. Tick items as you go (ticks are saved in this browser only). Open <code>data/import/preview.html</code> to read any article as it will look on the site.</p>
${sections.map(s => `<h2>${esc(s.title)} (${s.list.length})</h2><p class="why">${esc(s.why)}</p>
<ul>${s.list.map(x => `<li><label><input type="checkbox" data-k="${esc(s.title + '|' + x.id)}">${label(x)}</label>${s.brief ? '' : noteLine(x)}</li>`).join('')}</ul>`).join('')}
<script>
document.querySelectorAll('input[data-k]').forEach(b=>{try{b.checked=localStorage.getItem(b.dataset.k)==='1'}catch{}
b.addEventListener('change',()=>{try{localStorage.setItem(b.dataset.k,b.checked?'1':'0')}catch{}})})
</script>`

const out = path.join(IMPORT_DIR, 'decisions.html')
fs.writeFileSync(out, html)
console.log(`Decisions: ${out}`)
for (const s of sections) console.log(`  ${s.title}: ${s.list.length}`)

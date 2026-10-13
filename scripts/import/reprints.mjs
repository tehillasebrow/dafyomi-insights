// Columns printed more than once: keeps only the most recent copy (the site owner's
// decision, 2026-10-12). The older copy is set to "rejected" with a note, and its
// story pages, topics and other places move to the copy that's kept, so nothing is lost.
//
//   npm run import:reprints              shows what it would do
//   npm run import:reprints -- --write   does it
//
// Rules:
//   - A pair counts as a reprint when at least 70% of the older copy's text is in the
//     newer one. Less than that ("partly the same") keeps both and is only listed.
//   - The newer copy must be reviewed (approved/fixed) first; until then both wait.
//   - Two copies of the same printing (a few days apart: website and PDF) keep the
//     reviewed one, or the newer if both are reviewed.
//   - If a story from the older copy isn't in the newer one's text, both are kept and
//     listed, so no story page is lost.
//   - An article already published to the site is never touched.
// Safe to re-run (e.g. after more articles are reviewed).
import { listStaged, writeJson } from './lib/staging.mjs'
import { validateDraft, topicVocabulary, parseArgs, slugify } from '../lib/stories.mjs'

const args = parseArgs()
const write = Boolean(args.write)
const COVERED = 0.7
const SAME_PRINTING_DAYS = 10
const today = new Date().toISOString().slice(0, 10)
const vocabulary = topicVocabulary()

const rows = listStaged()
    .filter(r => (r.article.review?.status || 'pending') !== 'rejected')
    .sort((a, b) => String(a.article.published_at).localeCompare(String(b.article.published_at)))
for (const r of rows) r.status = r.article.review?.status || 'pending' // as it was before this run

const reviewed = r => ['approved', 'fixed'].includes(r.status)
const day = a => String(a.published_at).slice(0, 10)
const name = r => r.dir.split(/[\\/]/).slice(-3).join('/')
const label = r => `${day(r.article)} "${r.article.title}" [${r.status}]`
const storyKey = s => slugify(s.slug || s.title || '')

const shingles = rows.map(({ article }) => {
    const w = article.content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    const set = new Set()
    for (let i = 0; i + 5 <= w.length; i++) set.add(w.slice(i, i + 5).join(' '))
    return set
})

// Every pair with a lot of text in common, oldest first
const pairs = []
for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
        const [A, B] = [shingles[i], shingles[j]]
        if (!A.size || !B.size) continue
        const [small, big] = A.size < B.size ? [A, B] : [B, A]
        let shared = 0
        for (const s of small) if (big.has(s)) shared++
        if (shared / small.size < 0.4) continue

        const older = rows[i], newer = rows[j]
        const days = (new Date(day(newer.article)) - new Date(day(older.article))) / 864e5
        const samePrinting = days <= SAME_PRINTING_DAYS
        // Which copy stays: the newer, except a reviewed copy beats an unreviewed copy of the same printing
        const flip = samePrinting && reviewed(older) && !reviewed(newer)
        const [keeper, loser] = flip ? [older, newer] : [newer, older]
        const overlap = shared / (loser === older ? A.size : B.size) // share of the dropped copy found in the kept one
        pairs.push({ loser, keeper, overlap, samePrinting })
    }
}

const dropped = [], waiting = [], partial = [], storyGap = [], live = []
const gone = new Set()

for (const p of pairs) {
    if (gone.has(p.loser) || gone.has(p.keeper)) continue
    if (p.overlap < COVERED) { partial.push(p); continue }
    if (p.loser.status === 'published') { live.push(p); continue }
    if (!reviewed(p.keeper)) { waiting.push(p); continue }

    const from = p.loser.article, to = p.keeper.article
    // A story the kept copy already has (same slug, or the same people under another title) doesn't move
    const peopleKey = s => [...(s.people ?? [])].sort().join('|')
    const have = new Set((to.stories ?? []).flatMap(s => [storyKey(s), peopleKey(s) && `p:${peopleKey(s)}`]))
    const moving = (from.stories ?? []).filter(s => !have.has(storyKey(s)) && !have.has(`p:${peopleKey(s)}`))
    const missing = moving.filter(s => validateDraft({ stories: [s] }, { content: to.content }, vocabulary).errors.length)
    if (missing.length) { storyGap.push({ ...p, missing: missing.map(s => s.title) }); continue }

    // Move stories (kept in the order they appear in the article)
    if (moving.length) {
        to.stories = [...(to.stories ?? []), ...moving]
        const { stories } = validateDraft({ stories: to.stories }, { content: to.content }, vocabulary)
        const at = new Map(stories.map(s => [s.slug, s.start_offset]))
        to.stories.sort((x, y) => (at.get(storyKey(x)) ?? 0) - (at.get(storyKey(y)) ?? 0))
    }
    // Topics (up to 5) and other places, including the dropped copy's own daf if it differs
    if (Array.isArray(from.tags) && Array.isArray(to.tags)) {
        to.tags = [...new Set([...to.tags, ...from.tags])].slice(0, Math.max(5, to.tags.length))
    }
    if (Array.isArray(from.refs) || from.masechta) {
        const key = r => `${r.masechta}|${Number(r.daf)}`
        const seen = new Set([...(to.refs ?? []).map(key), key(to)])
        for (const r of [...(from.refs ?? []), { masechta: from.masechta, daf: Number(from.daf) }]) {
            if (!r?.masechta || seen.has(key(r))) continue
            seen.add(key(r))
            to.refs = [...(to.refs ?? []), r]
        }
    }

    const why = p.samePrinting
        ? `Second copy of the same printing as "${to.title}" (${day(to)}); that copy is kept.`
        : `Reprint: ${Math.round(p.overlap * 100)}% of this text is in "${to.title}" (${day(to)}). Only the most recent copy is published (site owner's decision).`
    from.review = { ...(from.review ?? {}), status: 'rejected', reprint_of: name(p.keeper), notes: [from.review?.notes, why].filter(Boolean).join(' '), reviewed_on: today }
    gone.add(p.loser)
    dropped.push({ ...p, moved: moving.map(s => s.title) })
}

const notGone = list => list.filter(p => !gone.has(p.loser) && !gone.has(p.keeper))
const pct = p => `${Math.round(p.overlap * 100)}%`

console.log(`Reprints: ${dropped.length} older copies ${write ? 'set aside' : 'would be set aside'} (the newer copy is kept).`)
for (const d of dropped) {
    console.log(`  ${label(d.loser)}  →  keeps ${label(d.keeper)}  (${pct(d)}${d.samePrinting ? ', same printing' : ''})`)
    if (d.moved.length) console.log(`      stories moved to the kept copy: ${d.moved.join('; ')}`)
}
const show = (title, list, line) => {
    if (!list.length) return
    console.log(`\n${title} (${list.length}):`)
    for (const p of list) console.log(`  ${line(p)}`)
}
show('Newer copy is missing a story the older one tells: both kept', notGone(storyGap), p => `${label(p.loser)}  /  ${label(p.keeper)}  (${pct(p)}; missing: ${p.missing.join('; ')})`)
show('Waiting for the newer copy to be reviewed', notGone(waiting), p => `${label(p.loser)}  →  ${label(p.keeper)}`)
show('Partly the same text, both kept', notGone(partial), p => `${pct(p)}  ${label(p.loser)}  /  ${label(p.keeper)}`)
show('Already on the site, left alone', notGone(live), p => `${label(p.loser)}  →  ${label(p.keeper)}`)

if (write) {
    const changed = new Set(dropped.flatMap(d => [d.loser, d.keeper]))
    for (const r of changed) writeJson(r.file, r.article)
    console.log(`\nSaved ${changed.size} file(s).`)
} else if (dropped.length) console.log('\nNothing saved. Run with -- --write to do it.')

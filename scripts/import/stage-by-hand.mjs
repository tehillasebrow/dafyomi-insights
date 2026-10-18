// Stages columns the PDF importer can't find on its own (no "By Rabbi Avrohom Sebrow" text line:
// the byline is a picture, or the column only has the "Daf Yomi Insights" heading), from a list
// of { id, date, page, other, headline } (data/import/recheck-todo.json, made by the 2026-10 recheck).
// The draft's text is every line of the column's pages, so the review (/review-import) has to cut
// it down to the column against page.jpg. Nothing is written to the database.
//
//   node scripts/import/stage-by-hand.mjs [--only <issue id>] [--other] [--todo <file>] [--dry-run]
// --other: also his other pieces (tributes, letters, features: they go under "Beyond the Daf")
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs } from '../lib/stories.mjs'
import { openPdf } from './lib/pdf.mjs'
import { sourceDir, saveArticle, slugify, writeReviewCsv } from './lib/staging.mjs'

const SOURCE = '5tjt'
const HEADERS = { Referer: 'https://view.flipdocs.com/', 'User-Agent': 'dafyomiinsights.com archive import (one-time)' }
const OLD_PDFS = path.join(sourceDir(SOURCE), 'hunt', 'oldpdfs')
const args = parseArgs()

const todo = JSON.parse(fs.readFileSync(args.todo || path.join(sourceDir(SOURCE), '..', 'recheck-todo.json'), 'utf8')).todo.filter(t => t.kind === 'daf column' || args.other)
const rows = fs.readFileSync(path.join(import.meta.dirname, '5tjt-flipdocs.tsv'), 'utf8').split(/\r?\n/).map(r => r.split('\t'))

// The issue's PDF and its links: Flipdocs, or a copy of the old 5tjt.com/pdfs/ file (id "arch…")
async function issuePdf(id) {
    if (id.startsWith('arch')) {
        const file = fs.readdirSync(OLD_PDFS).find(f => f.endsWith('.pdf') && 'arch' + f.replace(/\.pdf.*$|_Issue/gi, '') === id)
        return { buffer: fs.readFileSync(path.join(OLD_PDFS, file)), viewer: `https://web.archive.org/web/2007/http://www.5tjt.com/pdfs/${file}`, url: `http://www.5tjt.com/pdfs/${file}` }
    }
    const row = rows.find(r => r[1]?.endsWith(`_${id}`))
    const res = await fetch(row[5], { headers: HEADERS })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { buffer: Buffer.from(await res.arrayBuffer()), viewer: row[4], url: row[5] }
}

const cleanTitle = h => h.replace(/^Rabbi Sebrow responds.*?to ([A-Z][w ]+?)(?: letter)?[,)'].*$/i, 'Rabbi Sebrow Responds to $1').replace(/\s*\((?:running head|front|no separate|pull quote|birthdays|preventing|topic)[^)]*\)?.*$/i, '').replace(/^Daf Yomi Insights:?\s*/i, '').trim() || 'Daf Yomi Insights (untitled)'

for (const t of todo) {
    if (args.only && t.id !== String(args.only)) continue
    const pages = [t.page, ...(t.other || [])]
    const title = cleanTitle(t.headline)
    console.log(`${t.date}  ${t.id}  p.${pages.join(',')}  ${title}`)
    if (args['dry-run']) continue
    const { buffer, viewer, url } = await issuePdf(t.id)
    const pdf = await openPdf(buffer)
    try {
        const files = {}
        const text = []
        for (const n of pages) {
            const page = pdf.pages[n - 1]
            if (!page) continue
            text.push(`[PDF page ${n}]`, ...page.lines.filter(l => !l.rotated && l.text.trim()).map(l => l.text.trim()))
            files[n === t.page ? 'page.jpg' : `page-${n}.jpg`] = await sharp(await pdf.render(n, 1400)).jpeg({ quality: 80 }).toBuffer()
        }
        const article = {
            source: SOURCE,
            source_url: `${viewer}#page=${t.page}`,
            published_at: new Date(`${t.date.slice(0, 10)}T00:00:00Z`).toISOString(),
            title,
            slug: slugify(title),
            masechta: null,
            daf: null,
            summary: '',
            content: text.join('\n'),
            tags: [],
            words: 0,
            bio: null,
            pdf: { id: t.id, url, pages },
            daf_found_by: null,
            citations: [],
            photo: null,
            hand_staged: true,
            warnings: [
                'Staged by hand (the 2026-10 recheck found it; the importer could not read its byline). "content" is EVERY line of these PDF pages in raw order, with [PDF page N] markers: cut it down to just this column, in reading order, against page.jpg / page-<n>.jpg',
                'The byline may be a picture or only the "Daf Yomi Insights" heading: that is still his column',
                'Set the title (the printed headline; for an untitled early column, a short title in his words from the column), masechta/daf, summary, words and bio',
            ],
            review: { status: 'pending' },
        }
        const dir = saveArticle(SOURCE, article, files)
        console.log(`  -> ${path.basename(dir)}`)
    } finally {
        await pdf.close()
    }
}
if (!args['dry-run']) writeReviewCsv()

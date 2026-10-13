// Stages Rabbi Sebrow's old 5 Towns Jewish Times columns (2011–2020) from the paper's own
// archive of printed issues: 5tjt.com/paper/ links each issue to a Flipdocs flipbook, and
// behind each flipbook is the issue's full PDF. Nothing is written to the database.
//
//   npm run import:5tjt-pdf                      every issue in scripts/import/5tjt-flipdocs.tsv
//   npm run import:5tjt-pdf -- --issue 306203    one issue (its Flipdocs number)
//   npm run import:5tjt-pdf -- --year 2018       one year
//   options: --force (re-do issues already checked)
//
// The issue list (5tjt-flipdocs.tsv) was collected from 5tjt.com/paper/<year>/ on 2026-10-12.
// Only pages with the byline "By Rabbi Avrohom Sebrow" count (the masthead lists him in every
// issue, and Baila Sebrow writes in most of them).
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs } from '../lib/stories.mjs'
import { openPdf } from './lib/pdf.mjs'
import { findBylinePages } from './lib/issuu.mjs'
import { extractArticle, buildVocab } from './lib/layout.mjs'
import { chooseDaf } from './lib/daf.mjs'
import { sourceDir, writeJson, saveArticle, listStaged, writeReviewCsv, slugify, summarize } from './lib/staging.mjs'

const SOURCE = '5tjt'
const BOOK = '10001763'
const STATE = path.join(sourceDir(SOURCE), 'pdf-state.json')
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const HEADERS = { Referer: 'https://view.flipdocs.com/', 'User-Agent': 'dafyomiinsights.com archive import (one-time)' }

const args = parseArgs()

async function download(url, tries = 4) {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(url, { headers: HEADERS })
            if (res.ok) return Buffer.from(await res.arrayBuffer())
            if (res.status === 404 || attempt >= tries) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
        } catch (err) {
            if (err.status === 404 || attempt >= tries) throw err
        }
        await new Promise(r => setTimeout(r, 5000 * attempt))
    }
}

function readIssues() {
    const rows = fs.readFileSync(path.join(import.meta.dirname, '5tjt-flipdocs.tsv'), 'utf8').trim().split(/\r?\n/).slice(1)
    return rows.map(r => {
        const [year, flipId, title, parsha, viewer, pdf] = r.split('\t')
        return { year: +year, id: flipId.split('_')[1], title, parsha, viewer, pdf }
    })
}

// The date in the page's running header ("5 TOWNS JEWISH TIMES • July 27, 2018"), else from
// the issue's title in the list ("November 18th 2011", "5TJT 122515")
function issueDate(page, issue) {
    for (const line of page.lines) {
        const m = line.text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i)
        if (m && Math.abs(+m[3] - issue.year) <= 1) return { date: new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2])), exact: true }
    }
    const t = (issue.title || '').replace(/octover/i, 'october')
    const m = t.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\w*,?\s+(\d{4})/i)
    if (m) return { date: new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2])), exact: true }
    const n = t.match(/\b(\d{2})(\d{2})(\d{2})\b/)
    if (n) return { date: new Date(Date.UTC(2000 + +n[3], +n[1] - 1, +n[2])), exact: true }
    return { date: new Date(Date.UTC(issue.year, 0, 1)), exact: false }
}

// The article's photo: the biggest picture drawn inside the article's area of the page
async function findPhoto(pdf, pageNumber, region, pageJpeg) {
    const page = pdf.pages[pageNumber - 1]
    const byline = page.lines.find(l => /^\s*by\s+rabbi\s+avrohom\s+sebrow\s*$/i.test(l.text))
    const boxes = (await pdf.images(pageNumber))
        .map(b => {
            const ix = Math.max(0, Math.min(b.x + b.w, region.right) - Math.max(b.x, region.left))
            const iy = Math.max(0, Math.min(b.y + b.h, region.bottom) - Math.max(b.y, region.top))
            return { ...b, inside: (ix * iy) / (b.w * b.h || 1) }
        })
        // Most of it inside the article, not a tiny logo, not a whole-page background
        .filter(b => b.inside > 0.6 && b.w * b.h > 6000 && b.w * b.h < page.width * page.height * 0.5)
        // Not the "Daf Yomi Insights" header art beside the byline
        .filter(b => !(byline && byline.y >= b.y - 20 && byline.y <= b.y + b.h + 20))
        // Not an ad: ads carry their own text on top of the picture; a photo has none
        .filter(b => page.lines.filter(l => !l.rotated && l.x >= b.x && l.x <= b.x + b.w && l.y >= b.y && l.y <= b.y + b.h && l.text.trim().length > 2).length < 3)
        .sort((a, b) => b.w * b.h - a.w * a.h)
    if (!boxes.length) return null
    const box = boxes[0]
    const meta = await sharp(pageJpeg).metadata()
    const scale = meta.width / page.width
    const left = Math.max(0, Math.round(box.x * scale))
    const top = Math.max(0, Math.round(box.y * scale))
    const width = Math.min(meta.width - left, Math.round(box.w * scale))
    const height = Math.min(meta.height - top, Math.round(box.h * scale))
    if (width < 80 || height < 80) return null
    return sharp(pageJpeg).extract({ left, top, width, height }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
}

// The page number printed on a page (in its header or footer), or null
function printedNumber(page) {
    for (const l of page.lines) {
        if (l.y > 70 && l.y < page.height - 70) continue
        const m = l.text.match(/^\s*(\d{1,3})(?:\s|$)/) || l.text.match(/(?:^|\s|20\d\d)(\d{1,3})\s*$/)
        if (m && +m[1] > 0) return +m[1]
    }
    return null
}

// The printed numbers run ahead of the PDF's own page order when the PDF has extra pages (a
// wrap-around cover, inserts). "Continued on Page 65" means printed page 65.
function pageNumbering(pages) {
    const counts = new Map()
    for (const p of pages) {
        const n = printedNumber(p)
        if (n != null) counts.set(n - p.number, (counts.get(n - p.number) || 0) + 1)
    }
    const offset = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
    const byPrinted = new Map()
    for (const p of pages) {
        const n = printedNumber(p)
        if (n != null && n - p.number === offset) byPrinted.set(n, p.number)
    }
    return {
        printed: index => index + offset,
        index: printed => byPrinted.get(printed) ?? printed - offset,
    }
}

// "Continued on Page 72" on the column's page: the PDF page it jumps to, or null
function continuedTo(page, numbering) {
    for (const line of page.lines) {
        const m = line.text.match(/continued\s+on\s+page\s+(\d+)/i)
        if (m && numbering.index(+m[1]) > page.number) return numbering.index(+m[1])
    }
    return null
}

// The rest of the column on the page it jumps to: from "Continued from Page <from>" down its
// column, then on through the columns to the right, until his bio (or another article)
function continuationOf(page, from) {
    if (!page) return null
    const marker = page.lines.find(l => new RegExp(`continued\\s+from\\s+page\\s+${from}\\b`, 'i').test(l.text))
    if (!marker) return null
    const lines = page.lines.filter(l => !l.rotated && l.text.trim())
    const body = lines.filter(l => l.x >= marker.x - 15)
    // Columns by left edge; a paragraph indent (about 10 units) stays in its column
    const xs = [...new Set(body.map(l => Math.round(l.x)))].sort((a, b) => a - b)
    const groups = []
    for (const x of xs) {
        if (groups.length && x - groups.at(-1).max <= 20) groups.at(-1).max = x
        else groups.push({ min: x, max: x })
    }
    const ordered = []
    let started = false
    let done = false
    for (const g of groups) {
        if (done) break
        const col = body.filter(l => Math.round(l.x) >= g.min && Math.round(l.x) <= g.max).sort((a, b) => a.y - b.y)
        for (const l of col) {
            if (!started) {
                if (l === marker) started = true
                continue
            }
            if (/continued\s+(from|on)\s+page/i.test(l.text)) {
                if (/continued\s+on/i.test(l.text)) ordered.push(l) // kept so the next jump can be followed
                done = true
                break
            }
            ordered.push(l)
            if (HIS_BIO.test(l.text)) {
                // the bio's own lines follow in this column
                ordered.push(...col.filter(c => c.y > l.y && c.y - l.y < 60))
                done = true
                break
            }
        }
        if (!started) break // the marker's column comes first
    }
    return ordered.length ? { ...page, lines: [...new Map(ordered.map(l => [l, l])).keys()] } : null
}

const HIS_BIO = /^\s*rabbi\s+(av(ro|ra)h[ao]m\s+)?sebrow\s+(is|was|serves|teaches|leads|delivers)\b/i

// The top of a page up to his bio: the columns left of the bio's column, and the bio's column
// down to the end of the bio. For a column that runs on to the next page with no jump line.
function upToBio(page) {
    const bio = page.lines.find(l => HIS_BIO.test(l.text))
    if (!bio) return null
    const lines = page.lines.filter(l => !l.rotated && l.text.trim() && (l.x < bio.x - 20 || (Math.abs(l.x - bio.x) <= 20 && l.y <= bio.y + 60)))
    return { ...page, lines }
}

// Every later piece of the column, in order. 5TJT marks a jump with "Continued on Page N" and
// "Continued from Page M" on the other page, but not always: the "on" line can be missing, the
// "from" line can name the wrong page, and a column can simply run on to the next page.
function gatherParts(pages, number, numbering, vocab) {
    const parts = []
    const done = () => {
        const sofar = extractArticle(pages[number - 1], parts, { vocab })
        return !!sofar.error || !!sofar.bio || /[.!?”"’)]\s*$/.test(sofar.content)
    }
    const continuedFrom = n => pages.find(p => p.number > n && p.lines.some(l => new RegExp(`continued\\s+from\\s+page\\s+${numbering.printed(n)}\\b`, 'i').test(l.text)))?.number ?? null
    // Ends on its own page with his bio: nothing to follow (a jump line there is another article's)
    if (extractArticle(pages[number - 1], [], { vocab }).bio) return parts
    let from = number
    let last = pages[number - 1]
    while (parts.length < 4) {
        if (parts.length && last.lines.some(l => HIS_BIO.test(l.text))) break // reached his bio
        let to = continuedTo(last, numbering)
        let part = to ? continuationOf(pages[to - 1], numbering.printed(from)) : null
        // A "Continued from" line that names its own page (a misprint)
        if (to && !part) part = continuationOf(pages[to - 1], numbering.printed(to))
        if (!part) {
            if (done()) break
            to = continuedFrom(from)
            part = to ? continuationOf(pages[to - 1], numbering.printed(from)) : null
        }
        if (!part && pages[from]) {
            // No jump at all: it runs on to the next page
            to = from + 1
            part = upToBio(pages[from]) || pages[from]
        }
        if (!part) break
        parts.push(part)
        from = to
        last = part
        // (a jump line on this part is followed next time round, even if a sentence ends here)
    }
    return parts
}

// Same column already staged from the old website (the Internet Archive copy)?
const normTitle = t => (t || '').toLowerCase().replace(/^daf yomi( insights| highlights)?\s*[:–-]\s*/, '').replace(/[^a-z0-9]+/g, '')
function webCopy(title, date) {
    return listStaged(SOURCE).find(s => !s.article.pdf && s.article.review?.status !== 'rejected' && normTitle(s.article.title) === normTitle(title) && Math.abs(Date.parse(s.article.published_at) - date) < 21 * 86400000)
}

async function processIssue(issue) {
    const pdfBuffer = await download(issue.pdf)
    const pdf = await openPdf(pdfBuffer)
    try {
        const pages = pdf.pages
        const bylinePages = findBylinePages(pages)
        if (!bylinePages.length) return { status: 'none' }
        const vocab = buildVocab(pages)
        const numbering = pageNumbering(pages)
        const staged = []
        for (const number of bylinePages) {
            const page = pages[number - 1]
            // 5TJT prints "Continued on Page N" when a column jumps; only then is another page read
            // (A jump can jump again: to the page it names, or to the next page)
            const rest = gatherParts(pages, number, numbering, vocab)
            const extracted = extractArticle(page, rest, { vocab })
            if (extracted.error) {
                staged.push({ page: number, error: extracted.error })
                continue
            }
            const { date, exact } = issueDate(page, issue)
            const daf = chooseDaf(extracted.content, date)
            const warnings = [...extracted.warnings, ...daf.warnings]
            if (!exact) warnings.push('No date found for this issue: check published_at')
            const title = extracted.title || 'Untitled'

            const web = webCopy(title, date.getTime())
            if (web) {
                staged.push({ page: number, duplicateOf: path.basename(web.dir) })
                console.log(`  ${date.toISOString().slice(0, 10)}  p.${number}  ${title}  (already staged from the website: ${path.basename(web.dir)})`)
                continue
            }

            const pageImages = {}
            let photo = null
            for (const n of extracted.pages) {
                try {
                    const jpeg = await pdf.render(n, 1400)
                    if (n === number) {
                        try {
                            photo = await findPhoto(pdf, n, extracted.region, await pdf.render(n, 2400))
                        } catch (err) {
                            warnings.push(`Photo failed: ${err.message}`)
                        }
                    }
                    pageImages[n === number ? 'page.jpg' : `page-${numbering.printed(n)}.jpg`] = await sharp(jpeg).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
                } catch (err) {
                    warnings.push(`Could not save the image of page ${n}: ${err.message}`)
                }
            }
            if (!photo) warnings.push('No photo found in the article: check the page')

            const article = {
                source: SOURCE,
                source_url: `${issue.viewer}#page=${number}`,
                published_at: date.toISOString(),
                title,
                slug: slugify(title),
                masechta: daf.masechta,
                daf: daf.daf,
                summary: summarize(extracted.content),
                content: extracted.content,
                tags: [],
                words: extracted.words,
                bio: extracted.bio,
                pdf: { id: issue.id, url: issue.pdf, pages: extracted.pages, printed_pages: extracted.pages.map(numbering.printed) },
                daf_found_by: daf.how,
                citations: daf.citations.map(c => `${c.masechta} ${c.daf}${c.amud || ''}`),
                photo: photo ? 'photo.jpg' : null,
                warnings,
                review: { status: 'pending' },
            }
            const dir = saveArticle(SOURCE, article, { 'photo.jpg': photo, ...pageImages })
            console.log(`  ${date.toISOString().slice(0, 10)}  p.${number}  ${title}  (${daf.masechta} ${daf.daf}, ${extracted.words} words${warnings.length ? `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''})`)
            staged.push({ page: number, dir: path.basename(dir) })
        }
        return { status: 'article', staged }
    } finally {
        await pdf.close()
    }
}

async function main() {
    let state = { items: {} }
    try {
        state = JSON.parse(fs.readFileSync(STATE, 'utf8'))
    } catch {}
    let issues = readIssues().filter(i => i.year <= 2021)
    if (args.issue) issues = issues.filter(i => i.id === String(args.issue))
    if (args.year) issues = issues.filter(i => i.year === +args.year)
    const counts = { article: 0, none: 0, error: 0, skipped: 0 }
    for (const issue of issues) {
        if (state.items[issue.id] && state.items[issue.id].status !== 'error' && !args.force && !args.issue) {
            counts.skipped++
            continue
        }
        console.log(`${issue.year} ${issue.id} ${issue.title || issue.parsha}`)
        let result
        try {
            result = await processIssue(issue)
        } catch (err) {
            result = { status: 'error', error: err.message }
            console.log(`  error: ${err.message}`)
        }
        counts[result.status]++
        // (re-read first: several runs, one per year, may be going at once)
        try {
            state = JSON.parse(fs.readFileSync(STATE, 'utf8'))
        } catch {}
        state.items[issue.id] = { ...result, title: issue.title, checked: new Date().toISOString() }
        writeJson(STATE, state)
    }
    const review = writeReviewCsv()
    console.log(`\nIssues with his column: ${counts.article}, without: ${counts.none}, errors: ${counts.error}, already done: ${counts.skipped}`)
    console.log(`Review sheet: ${review.file} (${review.total} articles, ${review.needsCheck} to check)`)
}

await main()

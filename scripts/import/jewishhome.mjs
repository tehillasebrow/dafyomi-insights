// Finds Rabbi Sebrow's "Delving into the Daf" columns in The Jewish Home's issues on
// Issuu and stages them in data/import/jewishhome/ (nothing is written to the database).
//
//   npm run import:jh -- --issue 2022_08_04             one issue
//   npm run import:jh -- --since 2019-06-01             every issue since a date (the backfill)
//   npm run import:jh -- --latest                       the newest few issues (the weekly run)
//   options: --force (re-do issues already checked), --delay 1500 (ms between requests)
//
// An issue counts only if a page has the byline "By Rabbi Avrohom Sebrow".
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { parseArgs } from '../lib/stories.mjs'
import { setDelay } from './lib/http.mjs'
import { listIssues, getIssue, getTextLayer, getPageGraphics, getPageImage, findBylinePages, findColumnInContents, issueUrl } from './lib/issuu.mjs'
import { extractArticle } from './lib/layout.mjs'
import { cropPhoto } from './lib/photo.mjs'
import { chooseDaf } from './lib/daf.mjs'
import { readState, writeState, saveArticle, writeReviewCsv, slugify, summarize } from './lib/staging.mjs'

const SOURCE = 'jewishhome'
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

// The cover date printed in the page's running header ("The Jewish Home | AUGUST 4, 2022").
// Layout templates sometimes keep an old header, so only a date within 10 days after the
// upload date counts; otherwise the upload date is used.
function coverDate(page, uploaded) {
    const upload = Date.parse(uploaded + 'T00:00:00Z')
    for (const line of page.lines) {
        const m = line.text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i)
        if (!m) continue
        const date = Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2])
        if (date >= upload - 2 * 86400000 && date <= upload + 10 * 86400000) return new Date(date)
    }
    return new Date(upload)
}

export async function processIssue(doc, { log = console.log } = {}) {
    const issue = await getIssue(doc)
    const pages = await getTextLayer(issue)
    if (!pages) return { status: 'error', date: issue.date, error: 'Issue has no text layer' }

    const bylinePages = findBylinePages(pages)
    const tocPages = findColumnInContents(pages)
    if (!bylinePages.length) {
        // Listed in the contents but no byline found: something changed, flag it
        if (tocPages.length) return { status: 'error', date: issue.date, error: `Contents list Rabbi Sebrow on page ${tocPages.join(', ')} but no byline was found` }
        return { status: 'none', date: issue.date }
    }

    const staged = []
    for (const number of bylinePages) {
        const page = pages[number - 1]
        const extracted = extractArticle(page, pages.slice(number, number + 2))
        if (extracted.error) {
            staged.push({ page: number, error: extracted.error })
            continue
        }
        const date = coverDate(page, issue.date)
        const daf = chooseDaf(extracted.content, date)

        const warnings = [...extracted.warnings, ...daf.warnings]
        if (issue.access !== 'PUBLIC') warnings.push(`Issue access on Issuu is ${issue.access}`)

        let photo = null
        try {
            const graphics = await getPageGraphics(issue.page(number))
            if (graphics) {
                const crop = await cropPhoto(graphics, page, extracted.region)
                photo = crop.buffer
                warnings.push(...crop.warnings)
                if (crop.box && crop.box.width < 600) warnings.push(`Photo is small (${crop.box.width}px wide)`)
            } else warnings.push('No page graphics on Issuu: no photo')
        } catch (err) {
            warnings.push(`Photo failed: ${err.message}`)
        }

        // The newspaper page(s), for the review step: page.jpg, then page-<n>.jpg for continuations
        const pageImages = {}
        for (const n of extracted.pages) {
            try {
                pageImages[n === number ? 'page.jpg' : `page-${n}.jpg`] = await sharp(await getPageImage(issue.page(n)))
                    .resize({ width: 1400, withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer()
            } catch (err) {
                warnings.push(`Could not save the image of page ${n}: ${err.message}`)
            }
        }

        const title = extracted.title || 'Untitled'
        const article = {
            source: SOURCE,
            source_url: issueUrl(doc, number),
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
            issue: { doc, uploaded: issue.date, pages: extracted.pages, contents_pages: tocPages },
            daf_found_by: daf.how,
            citations: daf.citations.map(c => `${c.masechta} ${c.daf}${c.amud || ''}`),
            photo: photo ? 'photo.jpg' : null,
            warnings,
            review: { status: 'pending' },
        }
        const dir = saveArticle(SOURCE, article, { 'photo.jpg': photo, ...pageImages })
        log(`  ${date.toISOString().slice(0, 10)}  p.${number}  ${title}  (${daf.masechta} ${daf.daf}, ${extracted.words} words${warnings.length ? `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''})`)
        staged.push({ page: number, dir })
    }
    return { status: 'article', date: issue.date, pages: bylinePages, staged }
}

// Issue names newest-first, walking the profile pages until issues are older than `since`.
async function* issuesSince(since, state) {
    const cutoff = Date.parse(since + 'T00:00:00Z')
    let olderInARow = 0
    for (let profilePage = 1; ; profilePage++) {
        const docs = await listIssues(profilePage)
        if (!docs.length) return
        for (const doc of docs) {
            let date = state.items[doc]?.date
            if (!date) {
                try {
                    date = (await getIssue(doc)).date
                } catch {
                    date = null
                }
            }
            if (date && Date.parse(date + 'T00:00:00Z') < cutoff) {
                if (++olderInARow >= 15) return // the listing is newest-first; a run of old issues means we're done
                continue
            }
            olderInARow = 0
            yield doc
        }
    }
}

async function main() {
    const args = parseArgs()
    if (args.delay) setDelay(Number(args.delay))
    const state = readState(SOURCE)

    let docs
    if (args.issue) docs = [args.issue]
    else if (args.latest) docs = (await listIssues(1)).slice(0, Number(args.latest === true ? 4 : args.latest))
    else if (args.since) docs = issuesSince(args.since, state)
    else {
        console.log('Usage: --issue <name> | --since YYYY-MM-DD | --latest [n]   (see the top of this file)')
        process.exit(1)
    }

    const summary = { article: 0, none: 0, error: 0, skipped: 0 }
    for await (const doc of docs) {
        const known = state.items[doc]
        if (known && known.status !== 'error' && !args.force && !args.issue) {
            summary.skipped++
            continue
        }
        process.stdout.write(`${doc}\n`)
        let result
        try {
            result = await processIssue(doc)
        } catch (err) {
            result = { status: 'error', error: err.message }
        }
        if (result.status === 'error') console.log(`  ERROR: ${result.error}`)
        if (result.status === 'none') console.log('  (no column in this issue)')
        summary[result.status]++
        state.items[doc] = { ...result, staged: undefined, checked_at: new Date().toISOString() }
        writeState(SOURCE, state)
    }

    const review = writeReviewCsv()
    console.log(`\nIssues with the column: ${summary.article}, without: ${summary.none}, errors: ${summary.error}, already done: ${summary.skipped}`)
    console.log(`Review sheet: ${review.file} (${review.total} articles, ${review.needsCheck} to check)`)
    return summary
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main()
}

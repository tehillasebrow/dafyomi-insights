// Turns the old 5 Towns Jewish Times pages downloaded by fivetowns-fetch.mjs (from the
// Internet Archive, into data/import/5tjt/raw/) into staged articles in data/import/5tjt/.
// Only pages with Rabbi Avrohom Sebrow's byline or bio count: 5TJT also ran other
// Sebrows' columns (the dating forum, recipes) and other writers' Daf Yomi columns.
//
//   npm run import:5tjt
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { chooseDaf } from './lib/daf.mjs'
import { IMPORT_DIR, saveArticle, listStaged, writeReviewCsv, slugify, summarize } from './lib/staging.mjs'

const SOURCE = '5tjt'
const RAW = path.join(IMPORT_DIR, SOURCE, 'raw')

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' }
function decode(text) {
    return text
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}
const stripTags = html => decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
const meta = (html, prop) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]

// His first name has been spelled several ways (Avrohom, Avraham, Avrahom); early bios just
// say "Rabbi Sebrow leads / delivers …". "Rabbi" keeps out Baila and the other Sebrows.
const NAME = String.raw`rabbi\s+(?:av(?:ro|ra)h[ao]m\s+)?sebrow`
const BIO_VERBS = String.raw`(?:is|was|serves|teaches|leads|delivers|gives)\b`
const BYLINE = new RegExp(String.raw`^(written\s+)?by:?[\s_]*${NAME}\.?$`, 'i')
const BIO = new RegExp(String.raw`^${NAME}\s+${BIO_VERBS}`, 'i')
// For pages the downloader filed under "other Sebrow": is it his after all?
const HIS_PAGE = new RegExp(String.raw`by:?[\s_]*(?:<[^>]+>\s*)*${NAME}|${NAME}\s+${BIO_VERBS}`, 'i')
const JUNK = /^(share|tweet|related|advertisement|click here|subscribe|please share|home \| pdf archive|5tjt\.com all rights reserved)/i

// Some old pages were saved twice-encoded ("Iâ€™ll" for "I’ll")
const MOJIBAKE = { 'â€™': '’', 'â€˜': '‘', 'â€œ': '“', 'â€\u009d': '”', 'â€“': '–', 'â€”': '—', 'â€¦': '…', 'Â ': ' ', 'Ã©': 'é' }
const fixMojibake = text => text.replace(/â€™|â€˜|â€œ|â€\u009d|â€“|â€”|â€¦|Â |Ã©/g, m => MOJIBAKE[m]).replace(/â€/g, '”')

// Where the column starts on the page, for each design the site has had since 2010
const STARTS = [
    /<div class="td-post-content/, // 2017–2021 (Newspaper theme)
    /<div class="td_block_wrap tdb_single_content/,
    /<div class="entry-content/, // 2016–2017
    /<h1 class="entry_title/, // 2012–2016
    /class="createdate"[\s\S]*?<\/tr>/, // 2010–2011 (Joomla)
]
const ENDS = /<footer|<div class="td-post-source-tags|<div class="td-post-sharing-bottom|<div class="td-author-name|<div class="jp-relatedposts|<div class="sharedaddy|<div class="ssba|<div id="ssba|<!-- Simple Share|<span class="article_separator|<div id="jc"|<div id="comments|<div class="post-meta|<div class="navigation/

// The column's text as blocks ({ text, heading }), in order
function articleBody(html) {
    // The start marker closest before his byline (or bio): sidebars reuse the same class names
    const bioAt = html.search(new RegExp(String.raw`${NAME}\s+${BIO_VERBS}`, 'i'))
    const anchor = bioAt >= 0 ? bioAt : html.search(new RegExp(String.raw`>\s*by:?[\s_]*(?:<[^>]+>\s*)*${NAME}`, 'i'))
    let start = -1
    for (const re of STARTS) {
        for (const m of html.matchAll(new RegExp(re.source, 'g'))) {
            if (anchor >= 0 && m.index > anchor) break
            start = m.index + (re.source.startsWith('class="createdate"') ? m[0].length : 0)
        }
        if (start >= 0) break
    }
    // 2007 site: the bio sits in a box beside the text, before it; the text is in Verdana
    if (start < 0 && /PrintArticle\.asp/i.test(html)) {
        const m = html.slice(Math.max(anchor, 0)).match(/<font face="Verdana" size="2">/i)
        if (m) start = Math.max(anchor, 0) + m.index
    }
    if (start < 0) return null
    let body = html.slice(start)
    // The end: the first share bar / comments / footer after his bio (some pages put share buttons on top too)
    const from = bioAt > start ? bioAt - start : 1
    const end = body.slice(from).search(ENDS)
    if (end >= 0) body = body.slice(0, from + end)
    body = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
    body = body.replace(/<div class="td-a-rec[\s\S]*?<\/div>/g, '').replace(/<figure[\s\S]*?<\/figure>/g, '').replace(/<div[^>]*class="[^"]*wp-caption[\s\S]*?<\/div>/g, '').replace(/<div class="faceandtweet[\s\S]*?<div style="clear:both;?"><\/div><\/div>/g, '')
    body = body.replace(/<h1[\s\S]*?<\/h1>/i, '') // the headline

    // Mark headings, then break into paragraphs at block tags and double line breaks
    body = body
        .replace(/<(h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, t, inner) => `\n\n\u0001${inner}\n\n`)
        .replace(/<p\b[^>]*>\s*<(strong|b)>([^<]{1,80})<\/\1>\s*<\/p>/gi, (_, t, inner) => `\n\n\u0001${inner}\n\n`)
        .replace(/<\/?(p|div|blockquote|li|ul|ol|table|tr|td)\b[^>]*>/gi, '\n\n')
        .replace(/(<br\s*\/?>\s*){2,}/gi, '\n\n')

    const blocks = []
    for (const part of body.split(/\n\s*\n/)) {
        const heading = part.trimStart().startsWith('\u0001')
        const text = fixMojibake(stripTags(part.replace('\u0001', '')))
        if (!text) continue
        blocks.push({ text, heading })
    }
    return blocks
}

// The date the column ran: from the page itself if it says, else from the archive
function pageDate(html, entry) {
    const iso = meta(html, 'article:published_time') || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || html.match(/class="entry-date published" datetime="([^"]+)"/)?.[1]
    if (iso) return { date: new Date(iso), exact: true }
    const joomla = html.match(/class="createdate">\s*\w+,\s*(\d{1,2} \w+ \d{4})/)?.[1]
    if (joomla) return { date: new Date(`${joomla} UTC`), exact: true }
    const asp = html.match(/Published:\s*\w+,\s*(\w+ \d{1,2}, \d{4})/)?.[1]
    if (asp) return { date: new Date(`${asp} UTC`), exact: true }
    const ts = entry.timestamp
    return { date: new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T00:00:00Z`), exact: false }
}

function processPage(file, entry) {
    const html = fs.readFileSync(file, 'utf8')
    const blocks = articleBody(html)
    if (!blocks?.length) return { status: 'skipped', reason: 'no article body on the page' }

    const hasByline = blocks.slice(0, 4).some(b => BYLINE.test(b.text))
    const bioAt = blocks.findIndex(b => BIO.test(b.text))
    const metaAuthor = /av(ro|ra)h[ao]m sebrow/i.test(meta(html, 'author') || '') || new RegExp(String.raw`(Written by|By:)[\s_]*${NAME}\s*(<|-|&nbsp;)`, 'i').test(html)
    if (!hasByline && bioAt < 0 && !metaAuthor) return { status: 'skipped', reason: 'not by Rabbi Avrohom Sebrow' }

    const warnings = []
    const rawTitle = meta(html, 'og:title') || html.match(/<h1[^>]*class="entry[-_]title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] || html.match(/class="contentpagetitle">([\s\S]*?)<\/a>/)?.[1] || html.match(/class="contentheading"[^>]*>([\s\S]*?)<\/td>/)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
    let title = fixMojibake(decode(rawTitle)).replace(/^\s*Daf Yomi Insights\s*$/i, 'Daf Yomi Insights (untitled)')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*[-–|]?\s*(The )?(5|Five) ?Towns Jewish Times\s*$/i, '')
        .replace(/^Daf Yomi( Insights| Highlights)?\s*[:–-]\s*/i, '')
        .replace(/\s+Daf Yomi Insights$/i, '')
        .trim()
    if (!title && /Daf Yomi Insights/i.test(html)) title = 'Daf Yomi Insights (untitled)'
    if (!title) warnings.push('No title found')

    const { date, exact } = pageDate(html, entry)
    if (!exact) warnings.push('No publish date on the page: used the date the archive saved it (the column ran on or before this date)')
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

    let paragraphs = blocks
        .filter((b, i) => !BYLINE.test(b.text) && !(bioAt >= 0 && i >= bioAt) && !JUNK.test(b.text))
        .map(b => (b.heading ? `## ${b.text}` : b.text))
    const bio = bioAt >= 0 ? blocks[bioAt].text : ''
    // A heading at the very end is usually a "related posts" label
    while (paragraphs.at(-1)?.startsWith('## ')) paragraphs.pop()

    // Old columns headed only "Daf Yomi Insights" carry their real headline as the first line
    if (/untitled/.test(title) && paragraphs[0] && paragraphs[0].length < 70 && !/[.,]$/.test(paragraphs[0])) title = paragraphs.shift().replace(/^## /, '')
    if (/untitled/.test(title)) warnings.push('The page shows no headline of its own: choose a title')
    const content = paragraphs.join('\n\n')
    const words = content.split(/\s+/).filter(Boolean).length
    if (words < 300) warnings.push(`Only ${words} words: text may be missing`)
    if (bioAt < 0) warnings.push('No author bio at the end: check the ending')

    const daf = chooseDaf(content, day)
    warnings.push(...daf.warnings)

    // One address per column, however the archive saved it (http, :80, no www, ?amp, print view)
    const pathPart = entry.slug ?? entry.url.replace(/^https?:\/\/(www\.)?5tjt\.com(:80)?\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
    const url = `https://www.5tjt.com/${pathPart}/`
    return {
        status: 'article',
        article: {
            source: SOURCE,
            source_url: url,
            published_at: day.toISOString(),
            title,
            slug: slugify(title),
            masechta: daf.masechta,
            daf: daf.daf,
            summary: summarize(content),
            content,
            tags: [],
            words,
            bio,
            archive_url: `https://web.archive.org/web/${entry.timestamp}/${entry.url}`,
            daf_found_by: daf.how,
            citations: daf.citations.map(c => `${c.masechta} ${c.daf}${c.amud || ''}`),
            photo: entry.imageFile ? 'photo.jpg' : null,
            warnings: entry.imageFile ? warnings : [...warnings, 'No photo saved in the archive'],
            review: { status: 'pending' },
        },
    }
}

// Every downloaded page that is his, from all the download runs: data/import/5tjt/raw/index.json
// (first run) and any <run>/<part>/index-<n>.json under data/import/5tjt/ (archive searches)
function hisAfterAll(dir, e) {
    const file = path.join(dir, `${e.name}.html`)
    if (!fs.existsSync(file)) return false
    const text = fs.readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/&nbsp;/g, ' ')
    return HIS_PAGE.test(text)
}

function allEntries() {
    const found = []
    const old = path.join(RAW, 'index.json')
    if (fs.existsSync(old)) for (const e of JSON.parse(fs.readFileSync(old, 'utf8'))) if (e.bySebrow) found.push({ ...e, dir: RAW, name: e.slug })
    const walk = dir => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, f.name)
            if (f.isDirectory() && f.name !== 'articles') walk(p)
            else if (/^index-\d+\.json$/.test(f.name)) for (const e of JSON.parse(fs.readFileSync(p, 'utf8'))) if (e.kind === 'his' || (/sebrow|avrohom/.test(e.kind) && hisAfterAll(dir, e))) found.push({ ...e, dir })
        }
    }
    walk(path.join(IMPORT_DIR, SOURCE))
    // One per article: the print version and ?amp copies are the same column
    const byKey = new Map()
    for (const e of found) {
        const key = e.name.replace(/-tmpl-component-print.*$/, '').replace(/-amp-.*$/, '')
        const have = byKey.get(key)
        if (!have || (/tmpl-component-print|-amp-/.test(have.name) && !/tmpl-component-print|-amp-/.test(e.name)) || (!have.imageFile && e.imageFile)) byKey.set(key, e)
    }
    return [...byKey.values()]
}

async function main() {
    const counts = { article: 0, skipped: 0 }
    const dry = []
    const staged = new Set(listStaged(SOURCE).flatMap(s => [s.article.source_url, `title:${s.article.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${s.article.published_at.slice(0, 10)}`]))
    const seenColumns = new Set()
    const pdfColumns = listStaged(SOURCE).filter(s => s.article.pdf).map(s => s.article)
    for (const entry of allEntries()) {
        const RAW = entry.dir
        const file = path.join(RAW, `${entry.name}.html`)
        if (!fs.existsSync(file)) continue
        const result = processPage(file, entry)
        // --new-only: leave columns that are already staged alone (someone may be reviewing them)
        if (result.status === 'article' && process.argv.includes('--new-only') && staged.has(result.article.source_url)) continue
        // The same column saved under two addresses (old site sections: /local-news/…, /home-1-local/…)
        if (result.status === 'article') {
            const key = `${result.article.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${result.article.published_at.slice(0, 10)}`
            if (seenColumns.has(key) || (process.argv.includes('--new-only') && staged.has(`title:${key}`))) {
                console.log(`  skip  ${entry.name}: same column as another saved address`)
                continue
            }
            seenColumns.add(key)
            // Already staged from the printed issue's PDF (better: it has the page to check against)
            const norm = t => t.toLowerCase().replace(/^daf yomi( insights| highlights)?\s*[:–-]\s*/, '').replace(/[^a-z0-9]+/g, '')
            const fromPdf = pdfColumns.find(p => norm(p.title) === norm(result.article.title) && Math.abs(Date.parse(p.published_at) - Date.parse(result.article.published_at)) < 21 * 86400000)
            if (fromPdf) {
                console.log(`  skip  ${entry.name}: already staged from the printed issue (${fromPdf.published_at.slice(0, 10)})`)
                continue
            }
            // A section front page that only shows a teaser of the column
            if (result.article.words < 150) {
                console.log(`  skip  ${entry.name}: only ${result.article.words} words (a teaser, not the column)`)
                continue
            }
        }
        counts[result.status]++
        if (result.status !== 'article') {
            console.log(`  skip  ${entry.name}: ${result.reason}`)
            continue
        }
        let photo = null
        if (entry.imageFile) {
            try {
                photo = await sharp(fs.readFileSync(path.join(RAW, entry.imageFile))).flatten({ background: '#ffffff' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
            } catch (err) {
                result.article.warnings.push(`Photo could not be read: ${err.message}`)
                result.article.photo = null
            }
        }
        if (process.argv.includes('--dry-run')) dry.push({ name: entry.name, ...result.article })
        else saveArticle(SOURCE, result.article, { 'photo.jpg': photo })
        const a = result.article
        console.log(`  ${a.published_at.slice(0, 10)}  ${a.title}  (${a.masechta} ${a.daf}, ${a.words} words${a.warnings.length ? `, ${a.warnings.length} warning${a.warnings.length > 1 ? 's' : ''}` : ''})`)
    }
    if (process.argv.includes('--dry-run')) fs.writeFileSync(path.join(IMPORT_DIR, SOURCE, 'dry-run.json'), JSON.stringify(dry, null, 1))
    if (process.argv.includes('--dry-run')) return console.log(`
Dry run: ${counts.article} columns, ${counts.skipped} skipped`)
    const review = writeReviewCsv()
    console.log(`\n5TJT columns: ${counts.article}, skipped: ${counts.skipped}`)
    console.log(`Review sheet: ${review.file} (${review.total} articles, ${review.needsCheck} to check)`)
}

await main()

// Last pass for the missing 2007–2013 5TJT columns (the printed-issue list skips Dec 2011–Jul 2012
// and Nov 2012–Apr 2013, and has nothing before July 2011). Two things, both from the Internet Archive:
//
//   1. Printed issues: every Flipdocs book number the archive ever saw for the 5TJT account
//      (10001763), from the archive's own index and from old copies of the 5tjt.com home page and
//      "paper"/"issue" pages. New numbers can be read by scripts/import/fivetowns-pdf.mjs --issue.
//   2. Web columns: links on old copies of the home page and section pages (2007–2013) that look
//      like his column, downloaded and sorted like fivetowns-fetch.mjs does.
//
// Runs on GitHub (.github/workflows/hunt-5tjt.yml). Results go to data/import/5tjt/raw/:
// issues-found.json, other-files.json and index-0.json (+ the pages that are his).
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(import.meta.dirname, '..', '..', 'data', 'import', '5tjt', 'raw')
const KNOWN_TSV = path.join(import.meta.dirname, '5tjt-flipdocs.tsv')
const DELAY = 1200
const STOP_AT = Date.now() + 320 * 60 * 1000 // leave time to save before GitHub's limit
const READ_UNTIL = Date.now() + 200 * 60 * 1000 // then leave time to download the columns found

const sleep = ms => new Promise(r => setTimeout(r, ms))
let last = 0
async function get(url, { tries = 4 } = {}) {
    for (let attempt = 1; ; attempt++) {
        const wait = last + DELAY - Date.now()
        if (wait > 0) await sleep(wait)
        last = Date.now()
        try {
            const res = await fetch(url, { headers: { 'user-agent': 'dafyomiinsights.com archive import (one-time, ~1 request per second)' } })
            if (res.ok) return await res.text()
            if (res.status === 404 || res.status === 403) return null
            if (attempt >= tries) throw new Error(`HTTP ${res.status}`)
        } catch (err) {
            if (attempt >= tries) throw new Error(`${url}: ${err.message}`)
        }
        await sleep(8000 * attempt)
    }
}
function save(name, data) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 1))
}

// Archive index rows [original, timestamp, mimetype], following resume keys
async function cdx(params) {
    const rows = []
    let resumeKey = null
    for (;;) {
        const qs = new URLSearchParams({ fl: 'original,timestamp,mimetype', limit: '25000', showResumeKey: 'true' })
        for (const [k, v] of Object.entries(params)) for (const x of [v].flat()) qs.append(k, x)
        if (resumeKey) qs.set('resumeKey', resumeKey)
        const text = (await get(`https://web.archive.org/cdx/search/cdx?${qs}`).catch(err => (console.log(`  index error: ${err.message}`), ''))) || ''
        const [body, key] = text.split(/\n\s*\n/)
        for (const line of body.split('\n').filter(Boolean)) {
            const [original, timestamp, mimetype] = line.split(' ')
            if (original && timestamp) rows.push([original, timestamp, mimetype])
        }
        resumeKey = key?.trim() || null
        if (!resumeKey) return rows
    }
}

// --- 1. Flipdocs book numbers ----------------------------------------------------------------

const known = new Set(fs.readFileSync(KNOWN_TSV, 'utf8').split(/\r?\n/).slice(1).map(l => l.split('\t')[1]).filter(Boolean))
const issues = new Map() // "account_book" -> { firstSeen, sources:Set }
const otherFiles = new Map() // issuu / pdf links -> { firstSeen, source }
function noteIssue(id, timestamp, source) {
    const e = issues.get(id) || { firstSeen: timestamp, sources: new Set() }
    if (timestamp < e.firstSeen) e.firstSeen = timestamp
    if (e.sources.size < 5) e.sources.add(source)
    issues.set(id, e)
}
function scanForIssues(html, timestamp, source) {
    for (const m of html.matchAll(/flipdocs\.com[^"'\s<>]*?(?:ID=|books\/)(\d{6,9})[_/](\d{4,7})/gi)) noteIssue(`${m[1]}_${m[2]}`, timestamp, source)
    for (const m of html.matchAll(/https?:\/\/(?:www\.)?issuu\.com\/[a-z0-9_.-]+\/docs\/[^"'\s<>?#]+/gi)) if (!otherFiles.has(m[0])) otherFiles.set(m[0], { firstSeen: timestamp, source })
    for (const m of html.matchAll(/https?:\/\/[^"'\s<>]+?\.pdf\b/gi)) if (/5tjt|fivetowns|jewishtimes/i.test(m[0]) && !otherFiles.has(m[0])) otherFiles.set(m[0], { firstSeen: timestamp, source })
}

async function issuesFromIndex() {
    console.log('Flipdocs pages and files the archive saved for the 5TJT account…')
    const queries = [
        { url: 'view.flipdocs.com/?ID=10001763', matchType: 'prefix' },
        { url: 'view.flipdocs.com/?id=10001763', matchType: 'prefix' },
        { url: 'flipdocs.com/', matchType: 'domain', filter: 'original:.*10001763.*', collapse: 'urlkey' },
        { url: 's3.amazonaws.com/s3.flipdocs.com/books/10001763/', matchType: 'prefix', collapse: 'urlkey' },
        { url: 'cdn-view.flipdocs.com/books/10001763/', matchType: 'prefix', collapse: 'urlkey' },
    ]
    for (const q of queries) {
        const rows = await cdx(q)
        for (const [original, timestamp] of rows) {
            const m = original.match(/10001763[_/](\d{4,7})/)
            if (m) noteIssue(`10001763_${m[1]}`, timestamp, `archive index (${q.url})`)
        }
        console.log(`  ${q.url}: ${rows.length} rows, ${issues.size} book numbers so far`)
    }
    console.log('PDF files the archive saved from 5tjt.com…')
    for (const [original, timestamp] of await cdx({ url: '5tjt.com', matchType: 'domain', filter: 'mimetype:application/pdf', collapse: 'urlkey' })) {
        if (!otherFiles.has(original)) otherFiles.set(original, { firstSeen: timestamp, source: 'archive index (5tjt.com pdf)' })
    }
    console.log(`  ${otherFiles.size} PDF files`)
}

// --- 2. Old home page and section pages ------------------------------------------------------

const COLUMN_LINK = /daf|insight|sebrow|gemara|gemora|talmud/i
const SKIP = /\.(jpe?g|png|gif|css|js|pdf|xml|ico|svg)(\?|$)|\/feed\/?$|\/wp-|replytocom|\/comment-page-/i
const links = new Map() // key -> { url, timestamp, via }
const keyOf = url => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/:80\//, '/').replace(/#.*$/, '').replace(/[?&](amp|utm_[a-z]+)=?[^&]*/gi, '').replace(/\/+$/, '').toLowerCase().replace(/\?$/, '')

function scanForColumns(html, cap) {
    for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
        let href = m[1].replace(/&amp;/g, '&')
        // Archive copies (non-raw) rewrite links; raw ones may be relative
        href = href.replace(/^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\//, '')
        if (href.startsWith('/')) href = `http://www.5tjt.com${href}`
        if (!/^https?:\/\/(www\.)?5tjt\.com\//i.test(href) || SKIP.test(href)) continue
        const text = m[2].replace(/<[^>]+>/g, ' ')
        if (!COLUMN_LINK.test(href) && !COLUMN_LINK.test(text)) continue
        const key = keyOf(href)
        if (!links.has(key)) links.set(key, { url: href, timestamp: cap.timestamp, via: `${cap.original} @ ${cap.timestamp}` })
    }
}

async function pagesToRead() {
    // The home page once a week, 2007–2013 (one copy per week is enough to see every issue)
    const home = []
    for (const url of ['5tjt.com/', '5tjt.com/index.php', '5tjt.com/default.asp', '5tjt.com/index.asp']) {
        const rows = await cdx({ url, from: '2005', to: '2014', filter: 'statuscode:200', collapse: 'timestamp:8' })
        const byWeek = new Map()
        for (const [original, timestamp] of rows) {
            const week = Math.floor(Date.UTC(+timestamp.slice(0, 4), +timestamp.slice(4, 6) - 1, +timestamp.slice(6, 8)) / (7 * 864e5))
            if (!byWeek.has(week)) byWeek.set(week, { original, timestamp })
        }
        console.log(`  ${url}: ${rows.length} daily copies, ${byWeek.size} weeks`)
        home.push(...byWeek.values())
    }
    // Section, listing and "paper"/"issue" pages saved before 2014: every distinct copy
    const sectionRows = await cdx({ url: '5tjt.com', matchType: 'domain', from: '2005', to: '2014', filter: ['statuscode:200', 'mimetype:text/html'], collapse: 'digest' })
    const SECTION = /paper|issue|edition|flip|digital|current|archive|category|section|daf|torah|judaism|column|opinion|sebrow|catid=|\/home\/[^/]*$|\/(local|international)-news\/?$|blogsection|blogcategory/i
    const sections = sectionRows.filter(([original]) => SECTION.test(original) && !SKIP.test(original) && !/\/\d{3,}-|id=\d+:/.test(original)).map(([original, timestamp]) => ({ original, timestamp }))
    console.log(`  section and issue pages: ${sections.length} copies`)
    return [...home, ...sections]
}

// --- 3. Download the column links and sort them -----------------------------------------------

const NAME = String.raw`rabbi\s+(?:av(?:ro|ra)h[ao]m\s+)?sebrow`
function classify(html) {
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    if (new RegExp(String.raw`(?:by|<em>by):?\s*(?:<[^>]+>\s*)*${NAME}|${NAME}\s+(?:is|was|leads|serves|teaches|delivers|gives)\b`, 'i').test(text)) return { kind: 'his' }
    if (/sebrow/i.test(text)) {
        const who = [...new Set([...text.matchAll(/\b([A-Z][a-z]+)\s+Sebrow\b/g)].map(m => m[1]).filter(n => !/^(Avrohom|Avraham|Avrahom|Rabbi)$/.test(n)))].join(', ')
        return { kind: /av(ro|ra)h[ao]m/i.test(text) ? 'mentions-avrohom' : 'other-sebrow', who }
    }
    if (/daf\s+yomi\s+insights?/i.test(text)) return { kind: 'mentions-avrohom', who: '"Daf Yomi Insights" with no name' }
    return { kind: 'none' }
}
const fileNameOf = key => key.replace(/^5tjt\.com\/?/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'home'

async function main() {
    await issuesFromIndex()

    console.log('Old home page and section pages…')
    const pages = await pagesToRead()
    let n = 0
    for (const cap of pages) {
        if (Date.now() > READ_UNTIL) { console.log(`Out of time after ${n} of ${pages.length} pages`); break }
        const html = await get(`https://web.archive.org/web/${cap.timestamp}id_/${cap.original}`).catch(() => null)
        n++
        if (!html) continue
        scanForIssues(html, cap.timestamp, cap.original)
        scanForColumns(html, cap)
        if (n % 100 === 0) {
            console.log(`  ${n}/${pages.length} pages read: ${issues.size} book numbers, ${links.size} column links`)
            saveIssues()
        }
    }
    saveIssues()
    save('links.json', [...links].map(([key, v]) => ({ key, ...v })))
    console.log(`Book numbers: ${issues.size} (${[...issues.keys()].filter(id => !known.has(id)).length} not in our list). Column links: ${links.size}`)

    // Titles of the new Flipdocs books (the viewer page names the issue)
    for (const [id, e] of issues) {
        if (known.has(id) || Date.now() > STOP_AT) continue
        const html = await fetch(`https://view.flipdocs.com/?ID=${id}`).then(r => (r.ok ? r.text() : '')).catch(() => '')
        e.title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
        e.live = /books\/\d+\/\d+\/mobile\/th_0001/.test(html)
    }
    saveIssues()

    console.log('Downloading the column links…')
    const index = []
    for (const [key, c] of links) {
        if (Date.now() > STOP_AT) { console.log('Out of time'); break }
        const name = fileNameOf(key)
        try {
            const html = await get(`https://web.archive.org/web/${c.timestamp}id_/${c.url}`)
            let entry = { name, url: c.url, timestamp: c.timestamp, via: c.via, kind: 'missing' }
            if (html && html.length > 1500) {
                entry = { ...entry, ...classify(html) }
                if (entry.kind !== 'none') save(`${name}.html`, html)
            }
            index.push(entry)
            if (entry.kind !== 'none') console.log(`${entry.kind.padEnd(16)} ${c.timestamp.slice(0, 8)}  ${name}${entry.who ? `  (${entry.who})` : ''}`)
        } catch (err) {
            index.push({ name, url: c.url, via: c.via, kind: 'error', error: err.message })
        }
        if (index.length % 25 === 0) save('index-0.json', index)
    }
    save('index-0.json', index)
    const count = k => index.filter(e => e.kind === k).length
    console.log(`\nColumn links: his ${count('his')}, maybe ${count('mentions-avrohom') + count('other-sebrow')}, none ${count('none')}, missing ${count('missing')}, errors ${count('error')}`)
}

function saveIssues() {
    const list = [...issues].map(([id, e]) => ({ id, known: known.has(id), firstSeen: e.firstSeen, title: e.title, live: e.live, sources: [...e.sources] })).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))
    save('issues-found.json', list)
    save('other-files.json', [...otherFiles].map(([url, v]) => ({ url, ...v })).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen)))
}

await main()

// Collects Rabbi Sebrow's old 5 Towns Jewish Times columns (2005–2021) from the Internet
// Archive. 5tjt.com was rebuilt in 2024 and the old articles are gone from it; web.archive.org
// still has many of them. This only downloads (raw HTML + photos) into data/import/5tjt/raw/;
// scripts/import/fivetowns.mjs turns them into staged articles.
//
// It runs on GitHub (.github/workflows/fetch-5tjt.yml) because some networks block
// archive.org. No npm packages needed. Two steps, so the downloading can be split up:
//
//   node scripts/import/fivetowns-fetch.mjs --inventory        find candidate pages
//   node scripts/import/fivetowns-fetch.mjs --fetch 0/4        download a quarter of them
//
// Every downloaded page is sorted: "his" (byline or bio of Rabbi Avrohom Sebrow), "other-sebrow"
// (Baila, Goldie or another Sebrow: listed so a person can double-check), or "none".
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(import.meta.dirname, '..', '..', 'data', 'import', '5tjt', 'raw')
const arg = name => {
    const i = process.argv.indexOf(name)
    return i > 0 ? process.argv[i + 1] ?? true : null
}
const DELAY = 1200

const sleep = ms => new Promise(r => setTimeout(r, ms))
let last = 0
async function get(url, { binary = false, tries = 5 } = {}) {
    for (let attempt = 1; ; attempt++) {
        const wait = last + DELAY - Date.now()
        if (wait > 0) await sleep(wait)
        last = Date.now()
        try {
            const res = await fetch(url, { headers: { 'user-agent': 'dafyomiinsights.com archive import (one-time, ~1 request per second)' } })
            if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : await res.text()
            if (res.status === 404 || res.status === 403) return null
            if (attempt >= tries) throw new Error(`HTTP ${res.status}`)
        } catch (err) {
            if (attempt >= tries) throw new Error(`${url}: ${err.message}`)
        }
        await sleep(4000 * attempt)
    }
}

function save(name, data) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name), data)
}
const load = (name, fallback) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8'))
    } catch {
        return fallback
    }
}

// --- Wayback index (CDX) -----------------------------------------------------------------

// Rows of [original, timestamp, mimetype] for a query; pages through big results
async function cdxAll(params) {
    const base = new URLSearchParams({ output: 'json', fl: 'original,timestamp,mimetype', ...params })
    base.delete('filter')
    for (const f of [params.filter].flat().filter(Boolean)) base.append('filter', f)
    const pagesQs = new URLSearchParams(base)
    pagesQs.set('showNumPages', 'true')
    const numPages = Number((await get(`https://web.archive.org/cdx/search/cdx?${pagesQs}`))?.trim() || 1)
    const rows = []
    for (let page = 0; page < numPages; page++) {
        const qs = new URLSearchParams(base)
        qs.set('page', String(page))
        const text = await get(`https://web.archive.org/cdx/search/cdx?${qs}`)
        const json = JSON.parse(text || '[]')
        rows.push(...json.slice(json[0]?.[0] === 'original' ? 1 : 0))
        if (page % 10 === 0) console.log(`  index page ${page + 1}/${numPages}: ${rows.length} rows`)
    }
    return rows
}

// Distinct captures of one URL (newest first)
async function captures(url, { distinct = false } = {}) {
    const qs = new URLSearchParams({ url, output: 'json', fl: 'original,timestamp' })
    qs.append('filter', 'statuscode:200')
    if (distinct) qs.set('collapse', 'digest')
    const rows = JSON.parse((await get(`https://web.archive.org/cdx/search/cdx?${qs}`)) || '[]').slice(1)
    return rows.map(([original, timestamp]) => ({ original, timestamp })).reverse()
}

// --- Which pages might be his ------------------------------------------------------------

const KEYWORDS = /daf|insight|sebrow|gemara|gemora|talmud|masechta|mesechta|delving/i
const LISTING = /\/(author|category|tag)\/|[?&](author|cat)=|\/page\/\d+/i
const SKIP = /\.(jpe?g|png|gif|css|js|pdf|xml|ico|svg|woff2?)(\?|$)|\/feed\/?$|\/wp-json\/|\/wp-admin|\/wp-content\/|\/amp\/?$|replytocom|\/comment-page-/i

// Page key: one per article, whatever the URL variant (www, http, ?amp, trailing slash)
function keyOf(url) {
    const u = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/:80\//, '/').replace(/#.*$/, '').replace(/[?&](amp|utm_[a-z]+)=?[^&]*/gi, '').replace(/\/+$/, '').toLowerCase()
    return u.replace(/\?$/, '')
}
function fileNameOf(key) {
    return key.replace(/^5tjt\.com\/?/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'home'
}

async function inventory() {
    // 1. Every HTML page the archive has from the site (all years)
    console.log('Listing every archived page of 5tjt.com…')
    const rows = await cdxAll({ url: '5tjt.com', matchType: 'domain', collapse: 'urlkey', filter: ['statuscode:200', 'mimetype:text/html'] })
    console.log(`Archived pages: ${rows.length}`)
    save('all-urls.txt', rows.map(r => `${r[1]} ${r[0]}`).join('\n'))

    const candidates = new Map() // key -> { url, timestamp, via }
    const listings = new Map()
    for (const [original, timestamp] of rows) {
        if (SKIP.test(original)) continue
        const key = keyOf(original)
        if (LISTING.test(original) && /sebrow|daf|torah|judaism|column|opinion|talmud/i.test(original)) listings.set(key, original)
        else if (KEYWORDS.test(original) && !candidates.has(key)) candidates.set(key, { url: original, timestamp, via: 'url' })
    }
    console.log(`From page addresses: ${candidates.size} candidates, ${listings.size} listing pages`)

    // 2. Every distinct saved copy of every listing page; collect the article links
    let n = 0
    for (const listing of listings.values()) {
        const isAuthor = /sebrow/i.test(listing)
        const caps = await captures(listing, { distinct: true }).catch(() => [])
        const before = candidates.size
        for (const cap of caps) {
            const html = await get(`https://web.archive.org/web/${cap.timestamp}id_/${cap.original}`).catch(() => null)
            if (!html) continue
            const links = isAuthor
                ? [...html.matchAll(/href="(https?:\/\/(?:www\.)?5tjt\.com\/[^"#]+)"/gi)].map(m => m[1])
                : [...html.matchAll(/href="(https?:\/\/(?:www\.)?5tjt\.com\/[^"#]+)"[\s\S]{0,1500}?Sebrow/gi)].map(m => m[1])
            for (const href of links) {
                if (SKIP.test(href) || LISTING.test(href)) continue
                const key = keyOf(href)
                if (!candidates.has(key)) candidates.set(key, { url: href, timestamp: cap.timestamp, via: `listing ${listing}` })
            }
        }
        if (++n % 10 === 0 || candidates.size > before) console.log(`  listing ${n}/${listings.size} ${listing}: ${caps.length} copies, +${candidates.size - before}`)
    }

    const list = [...candidates].map(([key, c]) => ({ key, ...c }))
    save('candidates.json', JSON.stringify(list, null, 1))
    console.log(`Candidates to download: ${list.length}`)
}

// --- Download and sort ---------------------------------------------------------------------

function classify(html) {
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    if (/(?:by|<em>by)\s*(?:<[^>]+>\s*)*rabbi\s+avrohom\s+sebrow|rabbi\s+avrohom\s+sebrow\s+(?:is|was|leads|serves|teaches)\b|avrohom\s+sebrow\s+is\s+a\s+rebbe/i.test(text)) return { kind: 'his' }
    const names = [...new Set([...text.matchAll(/\b([A-Z][a-z]+)\s+Sebrow\b/g)].map(m => m[1]).filter(n => !/^(Avrohom|Rabbi)$/.test(n)))]
    if (/sebrow/i.test(text)) return { kind: /avrohom/i.test(text) ? 'mentions-avrohom' : 'other-sebrow', who: names.join(', ') }
    return { kind: 'none' }
}

async function fetchShard(shard, of) {
    const all = load('candidates.json', [])
    const mine = all.filter((_, i) => i % of === shard)
    const index = []
    console.log(`Shard ${shard + 1}/${of}: ${mine.length} pages`)
    for (const [n, c] of mine.entries()) {
        const name = fileNameOf(c.key)
        try {
            // Newest capture first; if it's an error or empty page, try a few older ones
            const caps = (await captures(c.url.replace(/^https?:\/\//, ''))).slice(0, 4)
            if (!caps.length && c.timestamp) caps.push({ original: c.url, timestamp: c.timestamp })
            let entry = { name, url: c.url, via: c.via, kind: 'missing' }
            for (const cap of caps) {
                const html = await get(`https://web.archive.org/web/${cap.timestamp}id_/${cap.original}`)
                if (!html || html.length < 2000) continue
                const cls = classify(html)
                entry = { name, url: cap.original, timestamp: cap.timestamp, via: c.via, ...cls }
                if (cls.kind !== 'none') {
                    save(`${name}.html`, html)
                    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
                        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
                    if (og && cls.kind === 'his') {
                        entry.image = og
                        const img = await get(`https://web.archive.org/web/${cap.timestamp}im_/${og}`, { binary: true }).catch(() => null)
                        if (img && img.length > 2000) {
                            const ext = (og.match(/\.(jpe?g|png|gif|webp)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase()
                            save(`${name}.${ext}`, img)
                            entry.imageFile = `${name}.${ext}`
                        }
                    }
                }
                break
            }
            index.push(entry)
            if (entry.kind !== 'none') console.log(`${entry.kind.padEnd(16)} ${entry.timestamp?.slice(0, 8) ?? ''}  ${name}${entry.who ? `  (${entry.who})` : ''}`)
        } catch (err) {
            index.push({ name, url: c.url, via: c.via, kind: 'error', error: err.message })
            console.log(`error            ${name}: ${err.message}`)
        }
        if (n % 25 === 0) save(`index-${shard}.json`, JSON.stringify(index, null, 1))
    }
    save(`index-${shard}.json`, JSON.stringify(index, null, 1))
    const count = k => index.filter(e => e.kind === k).length
    console.log(`\nShard ${shard + 1}: his ${count('his')}, other Sebrow ${count('other-sebrow') + count('mentions-avrohom')}, errors ${count('error')}, checked ${index.length}`)
}

if (arg('--inventory')) await inventory()
else if (arg('--fetch')) {
    const [shard, of] = String(arg('--fetch')).split('/').map(Number)
    await fetchShard(shard, of)
} else console.log('Usage: --inventory | --fetch <shard>/<of>')

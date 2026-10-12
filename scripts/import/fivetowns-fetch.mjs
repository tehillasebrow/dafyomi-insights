// Collects Rabbi Sebrow's old 5 Towns Jewish Times columns from the Internet Archive.
// 5tjt.com was rebuilt in 2024 and the old articles are gone from it; web.archive.org
// still has them. This only downloads (raw HTML + photos) into data/import/5tjt/raw/;
// scripts/import/fivetowns.mjs turns them into staged articles.
//
// It runs on GitHub (.github/workflows/fetch-5tjt.yml) because some networks block
// archive.org. No npm packages needed.
//
//   node scripts/import/fivetowns-fetch.mjs [--limit 20]
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(import.meta.dirname, '..', '..', 'data', 'import', '5tjt', 'raw')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity
const DELAY = 1500

const sleep = ms => new Promise(r => setTimeout(r, ms))
let last = 0
async function get(url, { binary = false, tries = 4 } = {}) {
    for (let attempt = 1; ; attempt++) {
        const wait = last + DELAY - Date.now()
        if (wait > 0) await sleep(wait)
        last = Date.now()
        try {
            const res = await fetch(url, { headers: { 'user-agent': 'dafyomiinsights.com archive import (one-time, 1 request per 1.5s)' } })
            if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : await res.text()
            if (res.status === 404) return null
            if (attempt >= tries) throw new Error(`HTTP ${res.status}`)
        } catch (err) {
            if (attempt >= tries) throw new Error(`${url}: ${err.message}`)
        }
        await sleep(5000 * attempt)
    }
}

// Wayback CDX: [{ original, timestamp }] for successful HTML captures
async function cdx(params) {
    const qs = new URLSearchParams({ output: 'json', fl: 'original,timestamp,statuscode,mimetype', collapse: 'urlkey', limit: '20000', ...params })
    const text = await get(`https://web.archive.org/cdx/search/cdx?${qs}`)
    if (!text) return []
    const rows = JSON.parse(text || '[]')
    return rows.slice(1).map(([original, timestamp, status, mime]) => ({ original, timestamp, status, mime }))
}

// All captures of one URL, newest successful one first
async function captures(url) {
    const qs = new URLSearchParams({ url, output: 'json', fl: 'original,timestamp,statuscode', filter: 'statuscode:200' })
    const text = await get(`https://web.archive.org/cdx/search/cdx?${qs}`)
    const rows = JSON.parse(text || '[]').slice(1)
    return rows.map(([original, timestamp]) => ({ original, timestamp })).reverse()
}

// "https://www.5tjt.com/daf-yomi-insights-x/?amp" -> "daf-yomi-insights-x"
function slugOf(url) {
    const m = url.replace(/[?#].*$/, '').match(/5tjt\.com(?::\d+)?\/(.+?)\/?$/i)
    if (!m) return null
    const parts = m[1].split('/').filter(Boolean).filter(p => p !== 'amp')
    // old article URLs are one segment: 5tjt.com/<slug>/ (some older ones are /<year>/<month>/<slug>/)
    const slug = parts.at(-1)
    if (!slug || /^(page|feed|author|category|tag|wp-|comment)/.test(parts[0])) return null
    return slug.toLowerCase()
}

function save(name, data) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name), data)
}

async function main() {
    const candidates = new Map() // slug -> { url, timestamp? }
    const add = (url, timestamp) => {
        const slug = slugOf(url)
        if (slug && !candidates.has(slug)) candidates.set(slug, { url: url.replace(/[?#].*$/, ''), timestamp })
    }

    // 1. Article URLs that start with "daf-yomi" (the column was "Daf Yomi Insights: <title>")
    for (const prefix of ['5tjt.com/daf-yomi', '5tjt.com/delving']) {
        const rows = await cdx({ url: prefix, matchType: 'prefix', filter: 'statuscode:200' })
        console.log(`${prefix}*: ${rows.length} URLs`)
        for (const r of rows) add(r.original, r.timestamp)
    }

    // 2. Any URL on the site mentioning Sebrow, and his author pages: their links find columns with other titles
    const listings = []
    for (const params of [
        { url: '5tjt.com/', matchType: 'prefix', filter: 'original:.*[Ss]ebrow.*' },
        { url: '5tjt.com/author/', matchType: 'prefix', filter: 'original:.*sebrow.*' },
    ]) {
        try {
            const rows = await cdx(params)
            console.log(`${params.url} ~sebrow: ${rows.length} URLs`)
            for (const r of rows) {
                if (/\/(author|category|tag)\//.test(r.original)) listings.push(r)
                else add(r.original, r.timestamp)
            }
        } catch (err) {
            console.log(`  (skipped: ${err.message})`)
        }
    }
    for (const listing of listings) {
        const html = await get(`https://web.archive.org/web/${listing.timestamp}id_/${listing.original}`)
        if (!html) continue
        for (const [, href] of html.matchAll(/href="(https?:\/\/(?:www\.)?5tjt\.com\/[^"#?]+)"/gi)) add(href)
    }
    console.log(`Candidates: ${candidates.size}`)
    save('candidates.json', JSON.stringify([...candidates], null, 2))

    // 3. Download each candidate's newest good capture; keep the ones by Rabbi Sebrow
    const index = []
    let n = 0
    for (const [slug, c] of candidates) {
        if (n >= LIMIT) break
        if (fs.existsSync(path.join(OUT, `${slug}.html`))) {
            index.push({ slug, ...c, cached: true })
            continue
        }
        n++
        try {
            const caps = await captures(c.url.replace(/^https?:\/\//, ''))
            const cap = caps[0] || (c.timestamp && { original: c.url, timestamp: c.timestamp })
            if (!cap) {
                index.push({ slug, url: c.url, error: 'no capture' })
                continue
            }
            const html = await get(`https://web.archive.org/web/${cap.timestamp}id_/${cap.original}`)
            if (!html) {
                index.push({ slug, url: c.url, error: 'capture missing' })
                continue
            }
            const bySebrow = /sebrow/i.test(html)
            const entry = { slug, url: cap.original, timestamp: cap.timestamp, bySebrow, captures: caps.length }
            if (bySebrow) {
                save(`${slug}.html`, html)
                const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
                if (og) {
                    entry.image = og
                    try {
                        const img = await get(`https://web.archive.org/web/${cap.timestamp}im_/${og}`, { binary: true })
                        if (img && img.length > 2000) {
                            const ext = (og.match(/\.(jpe?g|png|gif|webp)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase()
                            save(`${slug}.${ext}`, img)
                            entry.imageFile = `${slug}.${ext}`
                        }
                    } catch (err) {
                        entry.imageError = err.message
                    }
                }
            }
            index.push(entry)
            console.log(`${bySebrow ? 'SEBROW' : '  other'}  ${cap.timestamp.slice(0, 8)}  ${slug}${entry.imageFile ? '  +photo' : ''}`)
        } catch (err) {
            index.push({ slug, url: c.url, error: err.message })
            console.log(`  ERROR  ${slug}: ${err.message}`)
        }
        save('index.json', JSON.stringify(index, null, 2))
    }
    save('index.json', JSON.stringify(index, null, 2))
    console.log(`\nDone: ${index.filter(i => i.bySebrow).length} by Rabbi Sebrow, ${index.filter(i => i.error).length} errors, ${index.length} checked`)
}

await main()

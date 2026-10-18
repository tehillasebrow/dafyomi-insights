// scripts/photos/lib.mjs
// Free-license photos for articles the newspaper printed without one, from Wikimedia
// Commons and Openverse. Only licenses that allow reuse on a website and cropping are
// kept (public domain, CC0, CC BY, CC BY-SA); "non-commercial" and "no derivatives" are
// left out. CC BY / BY-SA photos are credited under the picture on the article page.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { IMPORT_DIR, ROOT, writeJson } from '../import/lib/staging.mjs'

export { writeJson, ROOT }
export const PHOTOS_DIR = path.join(ROOT, 'data', 'photos') // candidates and the hand-typed articles' photos
const UA = 'DafYomiInsightsBot/1.0 (https://dafyomiinsights.com)'
export const STOCK = 'stock.jpg'

export function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
        return fallback
    }
}

// Every article folder: staged newspaper articles, plus data/photos/manual/<slug>/ for
// the articles typed in by hand before the importer (they have only an id)
export function articleFolders() {
    const out = []
    for (const source of fs.readdirSync(IMPORT_DIR)) {
        const dir = path.join(IMPORT_DIR, source, 'articles')
        if (!fs.existsSync(dir)) continue
        for (const name of fs.readdirSync(dir)) {
            const file = path.join(dir, name, 'article.json')
            if (fs.existsSync(file)) out.push({ key: name, dir: path.join(dir, name), file, article: readJson(file) })
        }
    }
    const manual = path.join(PHOTOS_DIR, 'manual')
    if (fs.existsSync(manual)) {
        for (const name of fs.readdirSync(manual)) {
            const file = path.join(manual, name, 'article.json')
            if (fs.existsSync(file)) out.push({ key: name, dir: path.join(manual, name), file, article: readJson(file), manual: true })
        }
    }
    return out
}

export function findFolder(key) {
    const hit = articleFolders().find(f => f.key === key)
    if (!hit) throw new Error(`no article folder named ${key}`)
    return hit
}

async function getJson(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 5000 * (attempt + 1)))
            continue
        }
        if (!res.ok) throw new Error(`${res.status} ${url}`)
        return res.json()
    }
    throw new Error(`rate limited: ${url}`)
}

const stripHtml = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

// A license we may use, as { license, license_url, needsCredit }, or null
function allowedLicense(name, url) {
    const n = String(name || '').trim()
    if (/\b(nc|nd)\b/i.test(n.replace(/-/g, ' '))) return null
    if (/^(public domain|pd|pdm|cc0)/i.test(n) || /publicdomain/i.test(url || '')) return { license: 'Public domain', license_url: url || null, needsCredit: false }
    if (/^cc[ -]by([ -]sa)?[ -]?\d/i.test(n) || /^cc by( sa)?$/i.test(n)) return { license: n.toUpperCase().replace(/^CC[ -]BY[ -]SA/, 'CC BY-SA').replace(/^CC[ -]BY/, 'CC BY'), license_url: url || null, needsCredit: true }
    return null
}

export async function searchCommons(query, limit = 24) {
    const params = new URLSearchParams({
        action: 'query', format: 'json', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: String(limit),
        prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920', origin: '*',
    })
    const data = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`)
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    const out = []
    for (const p of pages) {
        const ii = p.imageinfo?.[0]
        if (!ii || !/jpeg|png/.test(ii.mime) || ii.width < 900) continue
        const m = ii.extmetadata ?? {}
        const lic = allowedLicense(m.LicenseShortName?.value, m.LicenseUrl?.value)
        if (!lic) continue
        out.push({
            provider: 'commons', title: p.title.replace(/^File:/, '').replace(/\.\w+$/, ''), width: ii.width, height: ii.height,
            thumb: ii.thumburl?.replace(/\/\d+px-/, '/330px-') ?? ii.url, full: ii.thumburl ?? ii.url,
            author: stripHtml(m.Artist?.value).slice(0, 80) || null, ...lic, source_url: ii.descriptionurl,
        })
    }
    return out
}

export async function searchOpenverse(query, limit = 20) {
    const params = new URLSearchParams({ q: query, license_type: 'commercial,modification', page_size: String(limit), mature: 'false' })
    const data = await getJson(`https://api.openverse.org/v1/images/?${params}`)
    const out = []
    for (const r of data.results ?? []) {
        if (r.source === 'wikimedia') continue // found through Commons directly, with better sizes
        if (r.width && r.width < 900) continue
        const lic = allowedLicense(r.license === 'cc0' || r.license === 'pdm' ? 'cc0' : `CC BY${r.license === 'by-sa' ? '-SA' : ''} ${r.license_version ?? ''}`.trim(), r.license_url)
        if (!lic || !['by', 'by-sa', 'cc0', 'pdm'].includes(r.license)) continue
        out.push({
            provider: 'openverse', title: r.title, width: r.width, height: r.height, thumb: r.thumbnail, full: r.url,
            author: r.creator?.slice(0, 80) || null, ...lic, source_url: r.foreign_landing_url,
        })
    }
    return out
}

// Uploads a photo to the site's storage and returns its public address. The name ends
// in a short fingerprint of the file, so a replaced picture gets a new address and no
// browser or image cache keeps showing the old one.
export async function uploadPhoto(db, keyBase, file) {
    const body = fs.readFileSync(file)
    const key = `${keyBase}-${crypto.createHash('sha1').update(body).digest('hex').slice(0, 8)}.jpg`
    const { error } = await db.storage.from('images').upload(key, body, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`photo upload: ${error.message}`)
    return db.storage.from('images').getPublicUrl(key).data.publicUrl
}

export async function download(url) {
    // Flickr refuses the large size of some newer photos: fall back to the 800px one
    const tries = [url, ...(/staticflickr\.com\/.*_b\.jpg$/.test(url) ? [url.replace(/_b\.jpg$/, '_c.jpg'), url.replace(/_b\.jpg$/, '.jpg')] : [])]
    let status
    for (const u of tries) {
        // Wikimedia asks for a named user agent; Flickr turns that same one away
        const res = await fetch(u, /wikimedia\.org/.test(u) ? { headers: { 'User-Agent': UA } } : {})
        if (res.ok) return Buffer.from(await res.arrayBuffer())
        status = res.status
    }
    throw new Error(`${status} ${url}`)
}

// A labelled grid of candidate thumbnails, to look at before picking
export async function contactSheet(candidates, file) {
    const C = 300, COLS = 4
    const comps = []
    const draw = async (c, i) => {
        const x = (i % COLS) * C, y = Math.floor(i / COLS) * (C + 26)
        try {
            const img = await sharp(await download(c.thumb)).resize(C - 8, C - 8, { fit: 'contain', background: '#ddd' }).toBuffer()
            comps.push({ input: img, left: x + 4, top: y + 4 })
        } catch {
            c.broken = true
        }
        const label = `${i}  ${c.width ?? '?'}x${c.height ?? '?'}  ${c.license}`.replace(/&/g, '&amp;')
        comps.push({ input: Buffer.from(`<svg width="${C}" height="26"><text x="4" y="18" font-size="16" font-family="Arial" fill="#c00">${label}</text></svg>`), left: x, top: y + C })
    }
    for (let i = 0; i < candidates.length; i += 4) await Promise.all(candidates.slice(i, i + 4).map((c, k) => draw(c, i + k)))
    const rows = Math.ceil(candidates.length / COLS)
    await sharp({ create: { width: C * COLS, height: Math.max(1, rows) * (C + 26), channels: 3, background: '#fff' } })
        .composite(comps).jpeg({ quality: 72 }).toFile(file)
}

// Final photo: at most 1600 wide. With crop, a tall or very wide picture is trimmed to
// 3:2 around its most interesting part (the site shows any shape whole, but share
// previews and the newsletter look best with a landscape picture)
export async function finishPhoto(buffer, { crop = false, position } = {}) {
    const img = sharp(buffer).rotate()
    const { width, height } = await img.metadata()
    const ratio = width / height
    let pipeline = img
    if (crop && (ratio < 1.3 || ratio > 1.8)) {
        const w = ratio < 1.5 ? width : Math.round(height * 1.5)
        const h = ratio < 1.5 ? Math.round(width / 1.5) : height
        pipeline = pipeline.resize(w, h, { fit: 'cover', position: position ?? sharp.strategy.attention })
    }
    return sharp(await pipeline.toBuffer()).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
}

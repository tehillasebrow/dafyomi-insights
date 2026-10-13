// scripts/import/lib/staging.mjs
// Imported articles are staged as files before anything touches the database:
//
//   data/import/<source>/state.json                 what was checked, so runs can resume
//   data/import/<source>/articles/<date>-<slug>/
//       article.json   the article (database fields + warnings + review status)
//       photo.jpg      the cropped photo
//       page.jpg       the newspaper page, for checking against
//   data/import/review.csv                          one row per article, opens in Excel
import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
export const IMPORT_DIR = path.join(ROOT, 'data', 'import')
export const REVIEW_CSV = path.join(IMPORT_DIR, 'review.csv')

export function sourceDir(source) {
    return path.join(IMPORT_DIR, source)
}

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
        return fallback
    }
}

export function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

export function readState(source) {
    return readJson(path.join(sourceDir(source), 'state.json'), { items: {} })
}

export function writeState(source, state) {
    writeJson(path.join(sourceDir(source), 'state.json'), state)
}

export function slugify(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/['‘’`]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

// First sentences of the article, up to ~280 characters
export function summarize(content) {
    const first = content.split(/\n\n/)[0] || ''
    const sentences = first.match(/[^.!?]+[.!?]+["”’)]*\s*/g) || [first]
    let summary = ''
    for (const s of sentences) {
        if (summary && (summary + s).length > 280) break
        summary += s
    }
    return summary.trim().slice(0, 400)
}

// Warnings that mean the text itself may be wrong: such an article waits for review
// instead of going live automatically. Others (a two-page article, a second picture)
// are notes; the weekly job publishes those.
const SERIOUS = [
    /^No title found/,
    /^No author bio found/,
    /^Only \d+ words/,
    /^Possible broken hyphenation/,
    /^Page has a box, table or wide section/,
    /^Left out a stray bit of text/,
    /^No photo found/,
    /^Photo failed/,
    /^Cited daf .* is far/,
    /^Issue access/,
]

export function seriousWarnings(article) {
    return (article.warnings || []).filter(w => SERIOUS.some(re => re.test(w)))
}

export function articleDir(source, article) {
    return path.join(sourceDir(source), 'articles', `${article.published_at.slice(0, 10)}-${article.slug || 'untitled'}`)
}

// files: { 'photo.jpg': Buffer, 'page.jpg': Buffer }
export function saveArticle(source, article, files = {}) {
    // Same newspaper page as an article staged before (maybe under a slightly different title)?
    // Then it's the same article: reuse its folder
    const existing = listStaged(source).find(s => s.article.source_url === article.source_url)
    const dir = existing?.dir ?? articleDir(source, article)
    // An article that has been reviewed (or published) is never overwritten: its corrections
    // were made by hand against the page. Re-importing only refreshes pending ones.
    const status = existing?.article.review?.status
    if (status && status !== 'pending') return dir
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, buffer] of Object.entries(files)) if (buffer) fs.writeFileSync(path.join(dir, name), buffer)
    if (!files['photo.jpg']) fs.rmSync(path.join(dir, 'photo.jpg'), { force: true })
    writeJson(path.join(dir, 'article.json'), article)
    return dir
}

export function listStaged(source) {
    const sources = source ? [source] : fs.existsSync(IMPORT_DIR) ? fs.readdirSync(IMPORT_DIR).filter(d => fs.existsSync(path.join(IMPORT_DIR, d, 'articles'))) : []
    const out = []
    for (const s of sources) {
        const base = path.join(sourceDir(s), 'articles')
        if (!fs.existsSync(base)) continue
        for (const name of fs.readdirSync(base).sort()) {
            const file = path.join(base, name, 'article.json')
            const article = readJson(file, null)
            if (article) out.push({ dir: path.join(base, name), file, article })
        }
    }
    return out
}

// Articles whose text mostly overlaps another staged article (the same column printed in
// both papers, or twice in one). Returns Map(dir -> [{ dir, title, date, overlap }]).
export function findSimilar(rows = listStaged()) {
    const shingles = rows.map(({ article }) => {
        const w = article.content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
        const set = new Set()
        for (let i = 0; i + 5 <= w.length; i++) set.add(w.slice(i, i + 5).join(' '))
        return set
    })
    const out = new Map()
    for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
            const [a, b] = shingles[i].size < shingles[j].size ? [shingles[i], shingles[j]] : [shingles[j], shingles[i]]
            if (!a.size) continue
            let shared = 0
            for (const s of a) if (b.has(s)) shared++
            const overlap = shared / a.size // share of the shorter article found in the longer one
            if (overlap < 0.4) continue
            for (const [x, y] of [[i, j], [j, i]]) {
                if (!out.has(rows[x].dir)) out.set(rows[x].dir, [])
                out.get(rows[x].dir).push({ dir: rows[y].dir, title: rows[y].article.title, date: rows[y].article.published_at.slice(0, 10), source: rows[y].article.source, overlap })
            }
        }
    }
    return out
}

export function similarWarning(list) {
    return list.map(s => `${Math.round(s.overlap * 100)}% the same text as "${s.title}" (${s.source}, ${s.date}): a reprint? keep one`)
}

const csvCell = value => {
    const s = value == null ? '' : String(value)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// One row per staged article. Rows that need a look come first.
export function writeReviewCsv() {
    const rows = listStaged()
    const similar = findSimilar(rows)
    const titles = new Map()
    for (const { article } of rows) {
        const key = slugify(article.title)
        titles.set(key, (titles.get(key) || 0) + 1)
    }
    const header = ['needs_check', 'review', 'date', 'source', 'title', 'masechta', 'daf', 'words', 'photo', 'warnings', 'starts_with', 'ends_with', 'source_url', 'folder']
    const lines = rows
        .map(({ dir, article: a }) => {
            const warnings = [...(a.warnings || [])]
            if (titles.get(slugify(a.title)) > 1) warnings.push('Same title as another article (duplicate?)')
            warnings.push(...similarWarning(similar.get(dir) || []))
            const status = a.review?.status || 'pending'
            return {
                needs: warnings.length && status === 'pending' ? 'CHECK' : '',
                cells: [
                    status,
                    a.published_at?.slice(0, 10),
                    a.source,
                    a.title,
                    a.standalone ? 'Beyond the Daf' : a.masechta,
                    a.daf,
                    a.words,
                    a.photo ? 'yes' : 'NO',
                    warnings.join(' | '),
                    a.content.slice(0, 120),
                    a.content.slice(-120),
                    a.source_url,
                    path.relative(ROOT, dir),
                ],
            }
        })
        .sort((x, y) => (y.needs ? 1 : 0) - (x.needs ? 1 : 0))
    const csv = [header, ...lines.map(l => [l.needs, ...l.cells])].map(r => r.map(csvCell).join(',')).join('\r\n')
    fs.mkdirSync(IMPORT_DIR, { recursive: true })
    fs.writeFileSync(REVIEW_CSV, '﻿' + csv + '\r\n') // BOM so Excel reads the quotes and dashes correctly
    return { file: REVIEW_CSV, total: rows.length, needsCheck: lines.filter(l => l.needs).length }
}

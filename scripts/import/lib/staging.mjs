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
    const dir = articleDir(source, article)
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, buffer] of Object.entries(files)) if (buffer) fs.writeFileSync(path.join(dir, name), buffer)
    // Keep a review decision made earlier (approved, fixed) unless the text changed
    const previous = readJson(path.join(dir, 'article.json'), null)
    if (previous?.review && previous.content === article.content) article.review = previous.review
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

const csvCell = value => {
    const s = value == null ? '' : String(value)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// One row per staged article. Rows that need a look come first.
export function writeReviewCsv() {
    const rows = listStaged()
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
            const status = a.review?.status || 'pending'
            return {
                needs: warnings.length && status === 'pending' ? 'CHECK' : '',
                cells: [
                    status,
                    a.published_at?.slice(0, 10),
                    a.source,
                    a.title,
                    a.masechta,
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

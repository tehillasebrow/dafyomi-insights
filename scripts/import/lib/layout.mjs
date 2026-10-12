// scripts/import/lib/layout.mjs
// Turns the positioned lines of a magazine page into an article: title, byline,
// paragraphs in reading order, and the author bio (kept apart from the text).
//
// Reading order: the body is set in newspaper columns. Body lines are grouped
// into columns by their left edge and read left to right, top to bottom; that
// also handles text that flows around a photo or a pull quote, because each
// column is still read downward. Pull quotes, captions, headers and ads use other
// type sizes and are left out. Every guess that might be wrong is recorded in
// `warnings`, so the review step knows where to look.

const HYPHEN = '\u0002' // Issuu's mark for a word broken across lines
const COLUMN_HEADING = /^(delving|into the|daf)$/i
const BYLINE = /^\s*by\s+rabbi\s+avrohom\s+sebrow\s*$/i
const BIO_START = /^rabbi\s+(avrohom\s+)?sebrow\s+(is|was|serves|teaches)\b/i

const clean = text => text.replace(/\n/g, ' ').replace(/ /g, ' ')

// Separate hyphen-mark lines become a flag on the line they belong to.
function attachHyphens(lines) {
    const marks = lines.filter(l => l.text.replace(/\s/g, '') === HYPHEN)
    const rest = lines.filter(l => !marks.includes(l))
    for (const line of rest) {
        if (line.text.includes(HYPHEN)) {
            line.hyphen = /\u0002\s*$/.test(line.text)
            line.text = line.text.replaceAll(HYPHEN, '')
        }
    }
    for (const mark of marks) {
        // The mark sits at the right edge of its line, a few units lower. Lines in
        // other columns share that height, so the owner is the nearest line to the left.
        const owner = rest
            .filter(l => l.x < mark.x && mark.y - l.y >= -2 && mark.y - l.y < 8 && Math.abs(l.size - mark.size) < 0.02)
            .sort((a, b) => b.x - a.x || Math.abs(mark.y - a.y) - Math.abs(mark.y - b.y))[0]
        if (owner) owner.hyphen = true
    }
    return rest
}

// Issuu sometimes stores one printed line as two pieces ("Rashi (Avodah Zarah" + " 52b) notes
// that"). A piece that starts outside every column's left-edge band (the edge plus a paragraph
// indent) is appended to the line on its left. An indented first line of a paragraph in the
// next column is inside that column's band, so it is left alone.
function mergeFragments(lines) {
    const bands = columns(lines, 20)
        .filter(c => c.lines.length >= 3)
        .map(c => [c.min - 2, c.max + 2])
    const inBand = x => bands.some(([lo, hi]) => x >= lo && x <= hi)
    const out = []
    for (const line of [...lines].sort((a, b) => a.x - b.x)) {
        const owner = !inBand(line.x) && out
            .filter(o => Math.abs(o.y - line.y) < 1 && o.x < line.x && line.x - o.x < 250 && Math.abs(o.size - line.size) < 0.01)
            .sort((a, b) => b.x - a.x)[0]
        if (owner) {
            owner.text += line.text
            owner.hyphen = line.hyphen
        } else out.push(line)
    }
    return out
}

function prepare(page) {
    return mergeFragments(attachHyphens(page.lines.filter(l => !l.rotated).map(l => ({ ...l }))))
}

function mode(values) {
    const counts = new Map()
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance

// Groups lines into columns by left edge. Paragraph indents (~13 units) stay in their column.
function columns(lines, gap) {
    const xs = [...new Set(lines.map(l => Math.round(l.x)))].sort((a, b) => a - b)
    const groups = []
    for (const x of xs) {
        const g = groups.at(-1)
        if (g && x - g.max <= gap) g.max = x
        else groups.push({ min: x, max: x })
    }
    return groups.map(g => {
        const members = lines.filter(l => Math.round(l.x) >= g.min && Math.round(l.x) <= g.max).sort((a, b) => a.y - b.y)
        return { left: mode(members.map(l => Math.round(l.x * 2) / 2)), min: g.min, max: g.max, lines: members }
    })
}

// A soft-hyphen mark or a line ending in "-" joins the next line without a space
// ("Tal" + "mud", "court-" + "mandated"); otherwise lines are joined with one space.
function joinLines(lines) {
    let text = ''
    lines.forEach((line, i) => {
        const t = clean(line.text).trim()
        if (i === 0) text = t
        else if (lines[i - 1].hyphen || /\w-$/.test(text)) text += t
        else text += ' ' + t
    })
    return text.replace(/\s+/g, ' ').trim()
}

const normalize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// page: { width, height, lines } from issuu.parseTextLayer. extraPages: the
// following pages, used only when the article doesn't end on its first page.
export function extractArticle(page, extraPages = []) {
    const warnings = []
    const lines = prepare(page)

    const byline = lines.find(l => BYLINE.test(clean(l.text)))
    if (!byline) return { error: 'No "By Rabbi Avrohom Sebrow" byline on this page' }

    const bodySize = mode(lines.filter(l => l.text.trim().length > 25).map(l => Math.round(l.size * 200) / 200))
    // The article's body fonts (regular, italic, bold): ads at the same size use other fonts
    const fontCounts = new Map()
    for (const l of lines) if (near(l.size, bodySize, bodySize * 0.06) && l.y > byline.y) fontCounts.set(l.font, (fontCounts.get(l.font) || 0) + 1)
    const bodyFonts = new Set([...fontCounts].filter(([, n]) => n >= 2).map(([f]) => f))
    const isBody = l => near(l.size, bodySize, bodySize * 0.06) && bodyFonts.has(l.font)

    // Title: the large lines just above the byline, below the "Delving into the Daf" heading
    const titleLines = lines
        .filter(l => l.size > bodySize * 2 && l.y < byline.y && byline.y - l.y < 160 && !COLUMN_HEADING.test(clean(l.text).trim()))
        .sort((a, b) => a.y - b.y || a.x - b.x)
    // The biggest lines are the title; a smaller line under it is a subtitle ("Title: Subtitle")
    const titleSize = Math.max(0, ...titleLines.map(l => l.size))
    const joinText = ls => ls.map(l => clean(l.text).trim()).join(' ').replace(/\s+/g, ' ').trim()
    const main = joinText(titleLines.filter(l => l.size > titleSize * 0.9))
    const sub = joinText(titleLines.filter(l => l.size <= titleSize * 0.9))
    const title = sub ? `${main.replace(/[:\s]+$/, '')}: ${sub}` : main
    if (!title) warnings.push('No title found')

    // Drop cap: one big letter that starts the article
    const dropCap = lines.find(l => /^[A-Z]$/.test(l.text.trim()) && l.size > bodySize * 2.5 && l.y > byline.y)

    let body = lines.filter(l => isBody(l) && l.y > byline.y - 2 && l.text.trim())
    const typicalLength = mode(body.map(l => Math.round(clean(l.text).length / 5) * 5))
    if (body.some(l => clean(l.text).length > typicalLength * 1.6)) {
        warnings.push('Page has a box, table or wide section: check the reading order')
    }
    // Subheadings: a little larger than the body, short, and lined up with a column
    const isHeading = l => l.size > bodySize * 1.05 && l.size < bodySize * 1.6 && clean(l.text).trim().length < 60
    const headings = lines.filter(l => isHeading(l) && l.y > byline.y + 5 && !BYLINE.test(clean(l.text)))
    let bioLines = []
    const bioStart = lines.find(l => BIO_START.test(clean(l.text).trim()) && l.y > byline.y)

    let { paragraphs, bioFromBody } = readColumns(body, headings, dropCap, bioStart, warnings)
    if (bioStart) {
        bioLines = lines
            .filter(l => near(l.x, bioStart.x, 3) && l.y >= bioStart.y - 1 && near(l.size, bioStart.size, 0.01))
            .sort((a, b) => a.y - b.y)
    }
    let bio = bioLines.length ? joinLines(bioLines) : bioFromBody

    // No bio on this page: the article may continue on the next one
    const pages = [page.number]
    if (!bio) {
        for (const next of extraPages) {
            const nextLines = prepare(next)
            // Another writer's byline means a different article starts there (ads with big type don't count)
            if (nextLines.some(l => /^s*bys+[A-Z]/i.test(clean(l.text)) && !BYLINE.test(clean(l.text)) && clean(l.text).length < 50)) break
            const nextBio = nextLines.find(l => BIO_START.test(clean(l.text).trim()))
            const more = readColumns(nextLines.filter(l => isBody(l) && l.text.trim()), nextLines.filter(isHeading), null, nextBio, warnings)
            if (!more.paragraphs.length) break
            pages.push(next.number)
            warnings.push(`Continues on page ${next.number}: check the join`)
            paragraphs = mergeContinuation(paragraphs, more.paragraphs)
            if (nextBio) {
                bio = joinLines(nextLines.filter(l => near(l.x, nextBio.x, 3) && l.y >= nextBio.y - 1 && near(l.size, nextBio.size, 0.01)).sort((a, b) => a.y - b.y))
                break
            }
        }
        if (!bio) warnings.push('No author bio found: the end of the article may be missing')
    }

    // Pull quotes repeat a sentence from the article; drop any paragraph that is fully contained in another
    const normalized = paragraphs.map(normalize)
    paragraphs = paragraphs.filter((p, i) => {
        const n = normalized[i]
        const repeated = !p.startsWith('## ') && n.length > 40 && normalized.some((m, j) => j !== i && m.length > n.length && m.includes(n))
        if (repeated) warnings.push(`Dropped a repeated passage (pull quote?): "${p.slice(0, 60)}…"`)
        return !repeated
    })

    const content = paragraphs.join('\n\n')
    const words = content.split(/\s+/).filter(Boolean).length
    if (words < 400) warnings.push(`Only ${words} words: text may be missing`)
    if (/\b\w+- \w/.test(content)) warnings.push('Possible broken hyphenation ("word- word")')

    return { title, content, bio, pages, words, warnings, region: regionOf([...titleLines, byline, ...body]) }
}

// Reads body lines column by column into paragraphs. A line indented from its
// column's left edge starts a paragraph; lines next to a drop cap don't.
function readColumns(body, headings, dropCap, bioStart, warnings) {
    let lines = body
    let bioFromBody = ''
    if (bioStart && lines.includes(bioStart)) {
        const bio = lines.filter(l => near(l.x, bioStart.x, 3) && l.y >= bioStart.y)
        bioFromBody = joinLines(bio.sort((a, b) => a.y - b.y))
        lines = lines.filter(l => !bio.includes(l))
    }

    const cols = columns(lines, 20)
    for (const c of cols.filter(c => c.lines.length < 3)) {
        if (/^d{1,3}$/.test(joinLines(c.lines))) continue // page number
        warnings.push(`Left out a stray bit of text: "${joinLines(c.lines).slice(0, 50)}"`)
    }
    const ordered = cols.filter(c => c.lines.length >= 3).sort((a, b) => a.left - b.left)

    // Each subheading joins the column it is aligned with; text that lines up with no column
    // (a centred pull quote) is left out
    const used = new Set()
    for (const col of ordered) {
        const own = headings.filter(h => !used.has(h) && h.x >= col.min - 4 && h.x <= col.max + 4)
        own.forEach(h => used.add(h))
        col.lines = [...col.lines, ...own.map(h => ({ ...h, heading: true }))].sort((a, b) => a.y - b.y)
    }
    const unplaced = headings.filter(h => !used.has(h) && !/^\d{1,3}$/.test(clean(h.text).trim()))
    if (unplaced.length) warnings.push(`Left out larger text (pull quote?): "${joinLines(unplaced).slice(0, 50)}"`)

    const paragraphs = []
    let current = []
    const flush = () => {
        if (current.length) paragraphs.push((current[0].heading ? '## ' : '') + joinLines(current))
        current = []
    }

    for (const col of ordered) {
        // Lines beside the drop cap are pushed right; they continue the first paragraph
        const capInColumn = dropCap && dropCap.x - col.left < 25 && col.left - dropCap.x < 25
        const capLines = capInColumn
            ? col.lines.filter(l => l.x > dropCap.x && l.x - col.left > 8 && l.y >= dropCap.y - 4 && l.y < dropCap.y + dropCap.size * 120)
            : []
        // A gap in a column (photo, pull quote) doesn't start a paragraph; only an indent does
        for (const line of col.lines) {
            if (dropCap && line === capLines[0]) {
                flush()
                current.push({ ...line, text: dropCap.text.trim() + line.text.trimStart() })
                continue
            }
            if (line.heading) {
                if (!current[0]?.heading) flush()
                current.push(line)
                continue
            }
            if (current[0]?.heading) flush()
            const indented = line.x - col.left > 6 && !capLines.includes(line)
            if (indented && current.length) flush()
            current.push(line)
        }
    }
    flush()
    return { paragraphs: paragraphs.filter(Boolean), bioFromBody }
}

// The first paragraph on a continuation page may finish the last sentence of the previous page.
function mergeContinuation(paragraphs, more) {
    const last = paragraphs.at(-1) || ''
    if (last && !/[.!?"”’)]$/.test(last) && !more[0].startsWith('## ')) {
        return [...paragraphs.slice(0, -1), `${last} ${more[0]}`, ...more.slice(1)]
    }
    return [...paragraphs, ...more]
}

function regionOf(lines) {
    if (!lines.length) return null
    const xs = lines.map(l => l.x)
    const ys = lines.map(l => l.y)
    return { left: Math.min(...xs), top: Math.min(...ys) - 30, right: Math.max(...xs) + 200, bottom: Math.max(...ys) + 10 }
}

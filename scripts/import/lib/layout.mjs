// scripts/import/lib/layout.mjs
// Turns the positioned lines of a magazine page into an article: title, byline,
// paragraphs in reading order, and the author bio (kept apart from the text).
//
// Reading order: the body is set in newspaper columns. Body lines are grouped
// into columns by their left edge and read left to right, top to bottom; that
// also handles text that flows around a photo or a pull quote, because each
// column is still read downward. Pull quotes and headers use other type sizes;
// captions and ads at body size are recognised as separate blocks in other
// fonts. Every guess that might be wrong is recorded in `warnings`, so the
// review step knows where to look.
//
// vocab (optional): every word used anywhere in the issue. It decides what a
// line break did to a word: "Tal|mud" -> "Talmud" because the issue uses
// "Talmud", but "three|day" -> "three-day" because it doesn't use "threeday".

const HYPHEN = '\u0002' // Issuu's mark for a word broken across lines
const COLUMN_HEADING = /^(delving|into the|daf|daf yomi( insights)?|insights)$/i
const BYLINE = /^\s*by\s+rabbi\s+avrohom\s+sebrow\s*$/i
const OTHER_BYLINE = /^\s*(By|BY)\s+[A-Z]/
const BIO_START = /^rabbi\s+(avrohom\s+)?sebrow\s+(is|was|serves|teaches|leads)\b/i
const PAGE_NUMBER = /^\d{1,3}$/
// Words that usually start a hyphenated compound, so a hyphen after them at a line end is kept
const COMPOUND_FIRST = new Set(['half', 'full', 'non', 'self', 'well', 'all', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twelve', 'hundred', 'thousand', 'million', 'long', 'short', 'high', 'low', 'old', 'anti', 'multi', 'semi', 'mid', 'great', 'brand', 'world'])

const clean = text => text.replace(/\n/g, ' ').replace(/ /g, ' ')
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance
const normalize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const bare = word => word.toLowerCase().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '')

function mode(values) {
    const counts = new Map()
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

// How often each word appears in the issue (lower case, no surrounding punctuation). Only
// words from the middle of a line count: the first or last word may be half of a broken word.
export function buildVocab(pages) {
    const vocab = new Map()
    for (const page of pages) {
        for (const line of page.lines) {
            const words = clean(line.text.replaceAll(HYPHEN, ' ')).split(/\s+/).filter(Boolean).slice(1, -1)
            for (const w of words) {
                const b = bare(w)
                if (b) vocab.set(b, (vocab.get(b) || 0) + 1)
            }
        }
    }
    return vocab
}

const seen = (vocab, word) => vocab?.get(bare(word)) || 0

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
            owner.endsSpace = line.endsSpace
        } else out.push(line)
    }
    return out
}

function prepare(page) {
    return mergeFragments(attachHyphens(page.lines.filter(l => !l.rotated).map(l => ({ ...l, endsSpace: /\s$/.test(l.text) }))))
}

// How a line break joins two pieces of text. `marked`: Issuu flagged a hyphen there.
function joinAcross(before, after, marked, vocab) {
    const a = before.match(/(\S+)$/)?.[1] ?? ''
    const b = after.match(/^(\S+)/)?.[1] ?? ''
    if (/\w-$/.test(before)) return before + after // a hyphen printed in the text: "court-" + "mandated"
    if (marked) {
        if (!vocab || !a || !b) return before + after // without a word list, assume a broken word
        // Inside a compound, look at the pieces touching the break: "Zevu|lun" in
        // "Yissachar-Zevu|lun" joins; "goat|bull" in "bull-goat|bull" keeps its hyphen
        const left = a.split('-').at(-1)
        const right = b.split('-')[0]
        if (seen(vocab, left + right)) return before + after // Tal|mud
        const keep = /^\p{Lu}/u.test(right) // non|Jew
            || COMPOUND_FIRST.has(bare(left)) // half|se'a, three|day
            || ((a.includes('-') || b.includes('-')) && seen(vocab, left) >= 1 && seen(vocab, right) >= 1) // bull-goat|bull
            // From a PDF the hyphen may be a real one: two common words that never appear joined keep it ("court-|mandated")
            || (marked === 'pdf' && seen(vocab, left) >= 2 && seen(vocab, right) >= 2)
        return keep ? `${before}-${after}` : before + after
    }
    // No hyphen mark, but the pieces only make sense as one word ("Mo" + "reover" -> "Moreover").
    // (A line ending without a space is no clue: lines ending in an italic word do that too.)
    if (vocab && a && b && /\p{L}$/u.test(a) && /^\p{Ll}/u.test(b)) {
        if (seen(vocab, a + b) && (!seen(vocab, a) || !seen(vocab, b))) return before + after
    }
    return `${before} ${after}`
}

function joinLines(lines, vocab) {
    let text = ''
    lines.forEach((line, i) => {
        const t = clean(line.text).trim()
        if (!t) return
        text = text ? joinAcross(text, t, lines[i - 1]?.hyphen, vocab) : t
    })
    return text.replace(/\s+/g, ' ').trim()
}

// The drop cap's letter plus the line beside it: "I" + "t says" -> "It says", but "I" + "once" -> "I once"
function capJoin(letter, text, vocab) {
    const first = text.trimStart().match(/^(\S+)/)?.[1] ?? ''
    if (vocab && /^[AI]$/.test(letter) && !seen(vocab, letter + first) && seen(vocab, first) >= 3) return `${letter} ${text.trimStart()}`
    return letter + text.trimStart()
}

// page: { number, width, height, lines } from issuu.parseTextLayer. extraPages: the following
// pages, used only when the article doesn't end on its first page. vocab: from buildVocab.
export function extractArticle(page, extraPages = [], { vocab = null, continueOnlyMidSentence = false } = {}) {
    const warnings = []
    const lines = prepare(page)

    const byline = lines.find(l => BYLINE.test(clean(l.text)))
    if (!byline) return { error: 'No "By Rabbi Avrohom Sebrow" byline on this page' }

    const bodySize = mode(lines.filter(l => l.text.trim().length > 25).map(l => Math.round(l.size * 200) / 200))
    const isBody = l => near(l.size, bodySize, bodySize * 0.06)

    // Title: the large lines just above the byline, below the "Delving into the Daf" heading
    const titleLike = l => l.size > bodySize * 2 && !COLUMN_HEADING.test(clean(l.text).trim()) && !/^[A-Z]$/.test(clean(l.text).trim())
    let titleLines = lines.filter(l => titleLike(l) && l.y < byline.y && byline.y - l.y < 160)
    // 5 Towns Jewish Times: "DAF YOMI", the byline, then the headline under it
    const titleBelow = !titleLines.length
    if (titleBelow) {
        const below = lines.filter(l => titleLike(l) && l.y > byline.y && l.y - byline.y < 90)
        const top = Math.min(...below.map(l => l.y))
        // Only the headline's own size: a pull quote nearby is smaller. Lines of a two-line
        // headline are close together; stop at the first gap.
        const big = Math.max(...below.map(b => b.size))
        const headline = below.filter(l => l.y - top < 90 && near(l.size, big, big * 0.15)).sort((a, b) => a.y - b.y)
        titleLines = headline.filter((l, i) => headline.slice(1, i + 1).every((m, j) => m.y - headline[j].y < big * 108 * 1.6))
    }
    titleLines.sort((a, b) => a.y - b.y || a.x - b.x)
    // The biggest lines are the title; a smaller line under it is a subtitle ("Title: Subtitle")
    const titleSize = Math.max(0, ...titleLines.map(l => l.size))
    const joinText = ls => ls.map(l => clean(l.text).trim()).join(' ').replace(/\s+/g, ' ').trim()
    const main = joinText(titleLines.filter(l => l.size > titleSize * 0.9))
    const sub = joinText(titleLines.filter(l => l.size <= titleSize * 0.9))
    const title = sub ? `${main.replace(/[:\s]+$/, '')}: ${sub}` : main
    if (!title) warnings.push('No title found')

    // Body text starts below the byline; in the 5TJT layout (the column's header box top left)
    // the columns to the right of the box start higher, at the top of the page
    const body = lines.filter(l => isBody(l) && (l.y > byline.y - 2 || (titleBelow && byline.end && l.x > byline.end + 10)) && l.text.trim())

    // The article's main body fonts (Issuu numbers each font): together they set most of
    // the text. A block of lines in none of them is a caption or an ad.
    const fontCounts = [...body.reduce((m, l) => m.set(l.font, (m.get(l.font) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])
    const mainFonts = new Set()
    let covered = 0
    for (const [font, n] of fontCounts) {
        if (covered >= body.length * 0.85 && n < body.length * 0.08) break
        mainFonts.add(font)
        covered += n
    }

    // Drop cap: a big single letter with body lines right beside it. Those lines are indented
    // to clear the letter; they're moved back to the column edge so they read in order.
    const dropCap = lines
        .filter(l => /^[A-Z]$/.test(l.text.trim()) && l.size > bodySize * 2.5 && l.y > byline.y - 2)
        .map(cap => ({ cap, beside: body.filter(l => l.x > cap.x + 8 && l.x - cap.x < 70 && l.y >= cap.y - 4 && l.y <= cap.y + cap.size * 105) }))
        .filter(c => c.beside.length)
        .sort((a, b) => a.cap.y - b.cap.y)[0]
    if (dropCap) {
        dropCap.beside.sort((a, b) => a.y - b.y)
        dropCap.beside.forEach((l, i) => {
            l.x = dropCap.cap.x + 1
            l.besideCap = true
            if (i === 0) l.text = capJoin(dropCap.cap.text.trim(), l.text, vocab)
        })
    }

    const typicalLength = mode(body.map(l => Math.round(clean(l.text).length / 5) * 5))
    if (body.some(l => !l.besideCap && clean(l.text).length > typicalLength * 1.6)) {
        warnings.push('Page has a box, table or wide section: check the reading order')
    }

    // Subheadings: a little larger than the body, short, and lined up with a column
    const isHeading = l => l.size > bodySize * 1.05 && l.size < bodySize * 1.6 && clean(l.text).trim().length < 60 && !PAGE_NUMBER.test(clean(l.text).trim())
    const headings = lines.filter(l => isHeading(l) && l.y > byline.y + 5 && !BYLINE.test(clean(l.text)))
    const bioStart = lines.find(l => BIO_START.test(clean(l.text).trim()) && l.y > byline.y)
    const opts = { mainFonts, vocab, warnings }

    const first = readColumns(body, headings, bioStart, opts)
    let paragraphs = first.paragraphs
    let bio = first.bio
    if (bioStart && !bio) {
        bio = joinLines(lines.filter(l => near(l.x, bioStart.x, 3) && l.y >= bioStart.y - 1 && near(l.size, bioStart.size, 0.01)).sort((a, b) => a.y - b.y), vocab)
    }

    // No bio on this page: the article may continue on the next one
    const pages = [page.number]
    // (PDF issues: only follow onto the next page if the text stops mid-sentence; old 5TJT
    // columns often have no bio, and the next page is a different article)
    const midSentence = () => !/[.!?”"’)]\s*$/.test(paragraphs.at(-1) || '')
    if (!bio && (!continueOnlyMidSentence || midSentence())) {
        for (const next of extraPages) {
            const nextLines = prepare(next)
            // Another writer's byline means a different article starts there (ads with big type don't count)
            // ("B Y  R A B B I …": letter-spaced bylines)
            const unspace = t => (/^(\S ){4,}/.test(t) ? t.replace(/(\S) (?=\S)/g, '$1').replace(/\s{2,}/g, ' ') : t)
            if (nextLines.some(l => OTHER_BYLINE.test(unspace(clean(l.text))) && !BYLINE.test(clean(l.text)) && clean(l.text).length < 50 && l.size > bodySize * 1.05 && near(l.size, byline.size, byline.size * 0.2))) break
            const nextBio = nextLines.find(l => BIO_START.test(clean(l.text).trim()))
            const more = readColumns(nextLines.filter(l => isBody(l) && l.text.trim()), nextLines.filter(isHeading), nextBio, opts)
            if (!more.paragraphs.length) continue // a full-page ad between the two parts
            pages.push(next.number)
            warnings.push(`Continues on page ${next.number}: check the join`)
            paragraphs = mergeContinuation(paragraphs, more.paragraphs, vocab)
            if (nextBio) {
                bio = more.bio || joinLines(nextLines.filter(l => near(l.x, nextBio.x, 3) && l.y >= nextBio.y - 1 && near(l.size, nextBio.size, 0.01)).sort((a, b) => a.y - b.y), vocab)
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

    if (/^\p{Ll}/u.test(paragraphs[0] || '')) {
        warnings.push(`The opening letter is missing (the big first letter is a picture): starts "${paragraphs[0].slice(0, 30)}…"`)
    }

    const content = paragraphs.join('\n\n')
    const words = content.split(/\s+/).filter(Boolean).length
    if (words < 400) warnings.push(`Only ${words} words: text may be missing`)
    if (/\b\w+- \w/.test(content)) warnings.push('Possible broken hyphenation ("word- word")')

    // An email address broken at a line end ("ASebrow@ gmail.com")
    bio = (bio || '').replace(/(\S@)\s+(\S)/g, '$1$2')
    return { title, content, bio, pages, words, warnings, region: regionOf([...titleLines, byline, ...first.kept]) }
}

// Reads body lines column by column into paragraphs. A line indented from its column's
// left edge starts a paragraph. Blocks that are captions or ads are left out.
function readColumns(body, headings, bioStart, { mainFonts, vocab, warnings }) {
    let lines = body
    let bio = ''
    if (bioStart && lines.includes(bioStart)) {
        const bioLines = lines.filter(l => near(l.x, bioStart.x, 3) && l.y >= bioStart.y)
        bio = joinLines(bioLines.sort((a, b) => a.y - b.y), vocab)
        lines = lines.filter(l => !bioLines.includes(l))
    }

    const cols = columns(lines, 20)
    for (const c of cols.filter(c => c.lines.length < 3)) {
        const text = joinLines(c.lines, vocab)
        if (!PAGE_NUMBER.test(text)) warnings.push(`Left out a stray bit of text: "${text.slice(0, 50)}"`)
    }
    const ordered = cols.filter(c => c.lines.length >= 3).sort((a, b) => a.left - b.left)

    // Split each column into blocks at large gaps; a block set entirely in other fonts is a caption or ad
    const gaps = ordered.flatMap(c => c.lines.slice(1).map((l, i) => l.y - c.lines[i].y)).filter(g => g > 0)
    const lineGap = mode(gaps.map(g => Math.round(g))) || 12
    const kept = []
    for (const col of ordered) {
        const blocks = []
        for (const line of col.lines) {
            const block = blocks.at(-1)
            if (block && line.y - block.at(-1).y <= lineGap * 1.7) block.push(line)
            else blocks.push([line])
        }
        col.lines = []
        for (const block of blocks) {
            if (mainFonts && !block.some(l => mainFonts.has(l.font) || l.besideCap)) {
                warnings.push(`Left out a caption or ad: "${joinLines(block, vocab).slice(0, 60)}"`)
                continue
            }
            col.lines.push(...block)
        }
        kept.push(...col.lines)
    }

    // Each subheading joins the column it is aligned with; text that lines up with no column
    // (a centred pull quote) is left out
    const used = new Set()
    for (const col of ordered) {
        const own = headings.filter(h => !used.has(h) && h.x >= col.min - 4 && h.x <= col.max + 4)
        own.forEach(h => used.add(h))
        col.lines = [...col.lines, ...own.map(h => ({ ...h, heading: true }))].sort((a, b) => a.y - b.y)
    }
    const unplaced = headings.filter(h => !used.has(h))
    if (unplaced.length) warnings.push(`Left out larger text (pull quote?): "${joinLines(unplaced, vocab).slice(0, 50)}"`)

    const paragraphs = []
    let current = []
    const flush = () => {
        if (current.length) paragraphs.push((current[0].heading ? '## ' : '') + joinLines(current, vocab))
        current = []
    }

    for (const col of ordered) {
        if (!col.lines.length) continue
        const left = mode(col.lines.filter(l => !l.heading && !l.besideCap).map(l => Math.round(l.x * 2) / 2)) ?? col.left
        // A gap in a column (photo, pull quote) doesn't start a paragraph; only an indent does
        for (const line of col.lines) {
            if (line.heading) {
                if (!current[0]?.heading) flush()
                current.push(line)
                continue
            }
            if (current[0]?.heading) flush()
            const indented = !line.besideCap && line.x - left > 6
            if (indented && current.length) flush()
            current.push(line)
        }
    }
    flush()
    return { paragraphs: paragraphs.filter(Boolean), bio, kept }
}

// The first paragraph on a continuation page may finish the last sentence of the previous page.
function mergeContinuation(paragraphs, more, vocab) {
    const last = paragraphs.at(-1) || ''
    if (last && !/[.!?"”’)]$/.test(last) && !more[0].startsWith('## ')) {
        return [...paragraphs.slice(0, -1), joinAcross(last, more[0], false, vocab), ...more.slice(1)]
    }
    return [...paragraphs, ...more]
}

function regionOf(lines) {
    if (!lines.length) return null
    const xs = lines.map(l => l.x)
    const ys = lines.map(l => l.y)
    return { left: Math.min(...xs), top: Math.min(...ys) - 30, right: Math.max(...xs) + 200, bottom: Math.max(...ys) + 10 }
}

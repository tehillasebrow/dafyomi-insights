// scripts/import/title-cards.mjs
// A picture for staged newspaper articles that have none: a plain typographic "title card"
// (1200×630 JPEG) in the site's Vilna Binding colours, with the article title, the
// masechta and daf, and "Daf Yomi Insights · Rabbi Avrohom Sebrow".
//
//   npm run import:cards                 dry run: lists the articles that would get a card
//   npm run import:cards -- --write      makes card.jpg in each article folder and sets
//                                        "photo": "card.jpg", "photo_generated": true
//   npm run import:cards -- --write --force   also remakes cards made before
//
// Only approved, fixed or held articles with no photo (or a photo file that's missing) get
// a card. A real photo is never replaced. Publishing uploads card.jpg like any other photo.
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { listStaged, writeJson, ROOT } from './lib/staging.mjs'

const args = process.argv.slice(2)
const write = args.includes('--write')
const force = args.includes('--force')

const CARD = 'card.jpg'
const W = 1200
const H = 630

// Colours from app/globals.css (--binding, --binding-ink, --binding-soft, --binding-line, --foil)
const BINDING = '#1c1e23'
const INK = '#f1eee5'
const SOFT = '#c9c6bc'
const LINE = '#6b6d73'
const FOIL = '#c8a24a'

// The site's serif is Newsreader with Georgia as the fallback; Georgia is on Windows.
// Elsewhere (a Linux runner) fall back to any serif-ish font that's around.
const FONT_DIRS = [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'), '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/truetype/liberation']
const FONT_CHOICES = {
    regular: ['georgia.ttf', 'LiberationSerif-Regular.ttf', 'DejaVuSerif.ttf'],
    bold: ['georgiab.ttf', 'LiberationSerif-Bold.ttf', 'DejaVuSerif-Bold.ttf'],
    italic: ['georgiai.ttf', 'LiberationSerif-Italic.ttf', 'DejaVuSerif-Italic.ttf'],
}
function registerFonts() {
    for (const [style, names] of Object.entries(FONT_CHOICES)) {
        const file = names.flatMap(n => FONT_DIRS.map(d => path.join(d, n))).find(f => fs.existsSync(f))
        if (!file) throw new Error(`no serif font found for ${style} (looked for ${names.join(', ')})`)
        GlobalFonts.registerFromPath(file, `Card ${style}`)
    }
}

// Typewriter quotes to curly ones
function curly(text) {
    return String(text)
        .replace(/(^|[\s(\[{“—-])"/g, '$1“').replace(/"/g, '”')
        .replace(/(^|[\s(\[{“—-])'/g, '$1‘').replace(/'/g, '’')
}

function wrap(ctx, text, maxWidth) {
    const lines = []
    let line = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line)
            line = word
        } else line = next
    }
    if (line) lines.push(line)
    return lines
}

// Biggest size at which the title fits the box; avoids a lone short word on the last line
function fitTitle(ctx, title, maxWidth, maxHeight) {
    for (let size = 84; size >= 36; size -= 2) {
        ctx.font = `${size}px "Card bold"`
        const lines = wrap(ctx, title, maxWidth)
        const lineHeight = Math.round(size * 1.16)
        const tooWide = lines.some(l => ctx.measureText(l).width > maxWidth)
        if (!tooWide && lines.length * lineHeight <= maxHeight && lines.length <= 4) {
            // Rebalance: if the last line is much shorter, narrow the box so lines even out
            const widths = ls => ls.map(l => ctx.measureText(l).width)
            const short = ls => { const w = widths(ls); return w[w.length - 1] < 0.45 * Math.max(...w) }
            if (lines.length > 1 && short(lines)) {
                for (let w = maxWidth - 10; w > maxWidth * 0.6; w -= 10) {
                    const tryLines = wrap(ctx, title, w)
                    if (tryLines.length > lines.length) break
                    lines.splice(0, lines.length, ...tryLines)
                    if (!short(tryLines)) break
                }
            }
            return { size, lines, lineHeight }
        }
    }
    ctx.font = '36px "Card bold"'
    return { size: 36, lines: wrap(ctx, title, maxWidth), lineHeight: 42 }
}

// The site mark (app/icon): two gold brackets around a square, on 32×32
function drawMark(ctx, x, y, s) {
    const u = s / 32
    ctx.fillStyle = FOIL
    const rects = [[5, 5, 9, 3], [5, 5, 3, 22], [18, 5, 9, 3], [24, 5, 3, 22], [10, 10, 12, 12], [10, 24, 12, 3]]
    for (const [rx, ry, rw, rh] of rects) ctx.fillRect(x + rx * u, y + ry * u, rw * u, rh * u)
}

export function renderCard({ title, masechta, daf, standalone }) {
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = BINDING
    ctx.fillRect(0, 0, W, H)

    // Binding frame: thin gold rule inset, with a hairline inside it
    ctx.strokeStyle = FOIL
    ctx.lineWidth = 2
    ctx.strokeRect(28, 28, W - 56, H - 56)
    ctx.strokeStyle = LINE
    ctx.lineWidth = 1
    ctx.strokeRect(38.5, 38.5, W - 77, H - 77)

    const left = 96
    const right = W - 96
    const width = right - left

    // Top: masechta + daf in gold small caps ("Beyond the Daf" for a piece not on a daf)
    const where = standalone ? 'Beyond the Daf' : [masechta, daf].filter(v => v != null && v !== '').join(' ')
    ctx.textBaseline = 'alphabetic'
    if (where) {
        ctx.font = '28px "Card regular"'
        ctx.fillStyle = FOIL
        ctx.letterSpacing = '5px'
        ctx.fillText(where.toUpperCase(), left, 122)
        ctx.letterSpacing = '0px'
    }

    // Footer: rule, mark, site name + author
    const footY = H - 112
    ctx.fillStyle = FOIL
    ctx.fillRect(left, footY, width, 2)
    drawMark(ctx, left, footY + 26, 40)
    ctx.font = '28px "Card regular"'
    ctx.fillStyle = SOFT
    ctx.fillText('Daf Yomi Insights  ·  Rabbi Avrohom Sebrow', left + 58, footY + 56)

    // Title, centred vertically between the top line and the footer
    const boxTop = 158
    const boxBottom = footY - 34
    const { lines, lineHeight, size } = fitTitle(ctx, curly(title).trim(), width, boxBottom - boxTop)
    ctx.font = `${size}px "Card bold"`
    ctx.fillStyle = INK
    const blockHeight = lines.length * lineHeight
    let y = boxTop + (boxBottom - boxTop - blockHeight) / 2 + size * 0.86
    for (const line of lines) {
        ctx.fillText(line, left, y)
        y += lineHeight
    }

    return canvas.encodeSync('jpeg', 85)
}

function main() {
    registerFonts()
    const targets = []
    for (const { dir, file, article } of listStaged()) {
        if (!['approved', 'fixed', 'held'].includes(article.review?.status)) continue
        const photoPath = article.photo && path.join(dir, article.photo)
        const hasPhoto = photoPath && fs.existsSync(photoPath)
        if (hasPhoto && !(article.photo_generated && article.photo === CARD)) continue // a real photo: never touch
        if (hasPhoto && !force) continue // already has a card
        targets.push({ dir, file, article })
    }

    const made = []
    for (const { dir, file, article } of targets) {
        const rel = path.relative(ROOT, dir)
        if (!write) {
            console.log(`would make card: ${rel}  "${article.title}"`)
            continue
        }
        fs.writeFileSync(path.join(dir, CARD), renderCard(article))
        writeJson(file, { ...article, photo: CARD, photo_generated: true })
        made.push(rel)
        console.log(`card: ${rel}  "${article.title}"`)
    }
    console.log(write ? `\n${made.length} title card(s) made.` : `\n${targets.length} article(s) would get a title card. Add --write to make them.`)
}

main()

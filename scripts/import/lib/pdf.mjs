// Reads a newspaper PDF into the same page shape as issuu.parseTextLayer, so the layout code
// (layout.mjs) works on both: { number, width, height, lines: [{ text, font, size, rotated, x, y }] }.
// y runs down the page (PDF runs up). Each page also lists where its pictures are (`images`),
// for cropping the article's photo out of the page image.
import { createCanvas } from '@napi-rs/canvas'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

// pdf.js draws pages onto a canvas; in Node that's @napi-rs/canvas
class CanvasFactory {
    create(width, height) {
        const canvas = createCanvas(width, height)
        return { canvas, context: canvas.getContext('2d') }
    }
    reset(cc, width, height) {
        cc.canvas.width = width
        cc.canvas.height = height
    }
    destroy(cc) {
        cc.canvas.width = 0
        cc.canvas.height = 0
    }
}

const round = n => Math.round(n * 100) / 100

// pdf.js gives text in runs ("resident", " ", "Donald"); runs on one baseline that touch are one line
function buildLines(items, height, fontIds, styles) {
    // Font names are per page in pdf.js; the same font has the same family and metrics everywhere
    const fontKey = name => { const st = styles[name] || {}; return `${st.fontFamily}|${st.ascent}|${st.descent}` }
    const lines = []
    let cur = null
    for (const item of items) {
        item.str = item.str.normalize('NFKC') // ligatures: "ﬁ" -> "fi"
        const [a, b, , d, e, f] = item.transform
        const rotated = Math.abs(a) < 1e-6 && Math.abs(b) > 1e-6
        // In Issuu units (about the point size / 108), which the layout code is tuned for
        const pt = rotated ? Math.abs(b) : Math.abs(a) || Math.abs(d)
        const size = pt / 108
        if (!item.str) {
            if (item.hasEOL && cur) cur.eol = true
            continue
        }
        const x = e
        const y = height - f - pt * 0.75 // the top of the line, as Issuu gives it
        // (Hebrew is drawn right to left, so a run may also extend the line to the left)
        const sameLine = cur && !cur.eol && !rotated && !cur.rotated && Math.abs(cur.y - y) < pt * 0.3 && ((x >= cur.end - pt * 0.5 && x - cur.end < pt * 1.2) || (x + item.width <= cur.x + pt * 0.5 && cur.x - (x + item.width) < pt * 1.2))
        // A size change on one line is a drop cap or a heading beside text: keep apart, unless it's tiny (a space)
        if (sameLine && (Math.abs(cur.size - size) < 0.05 / 108 || !item.str.trim())) {
            cur.pieces.push({ x, end: x + item.width, str: item.str, pt, dir: item.dir })
            cur.x = Math.min(cur.x, x)
            cur.end = Math.max(cur.end, x + item.width)
            cur.fonts.set(fontKey(item.fontName), (cur.fonts.get(fontKey(item.fontName)) || 0) + item.str.length)
        } else {
            cur = { pieces: [{ x, end: x + item.width, str: item.str, pt, dir: item.dir }], x, y, end: x + item.width, size, rotated, fonts: new Map([[fontKey(item.fontName), item.str.length]]) }
            lines.push(cur)
        }
        if (item.hasEOL) cur.eol = true
    }
    return lines.map(l => {
        // The line's runs in their order on the page, with a space where there's a gap
        l.text = ''
        let prevEnd = null
        // Hebrew runs (pdf.js marks them rtl; each run's own text is already in reading order) sit
        // on the page right to left: a stretch of them is read from its rightmost run
        const sorted = l.pieces.sort((a, b) => a.x - b.x)
        const ordered = []
        for (let i = 0; i < sorted.length; ) {
            if (sorted[i].dir !== 'rtl') {
                ordered.push(sorted[i++])
                continue
            }
            const run = []
            while (i < sorted.length && (sorted[i].dir === 'rtl' || (!sorted[i].str.trim() && sorted[i + 1]?.dir === 'rtl'))) {
                if (sorted[i].dir === 'rtl') run.push(sorted[i])
                i++
            }
            const start = run[0].x
            const end = run.at(-1).end
            ordered.push({ x: start, end, pt: run[0].pt, str: run.reverse().map(r => r.str.trim()).join(' ') })
        }
        for (const p of ordered) {
            if (prevEnd != null && p.x - prevEnd > p.pt * 0.05 && !/\s$/.test(l.text) && !/^\s/.test(p.str)) l.text += ' '
            l.text += p.str
            prevEnd = p.end
        }
        const font = [...l.fonts].sort((p, q) => q[1] - p[1])[0][0]
        if (!fontIds.has(font)) fontIds.set(font, fontIds.size + 1)
        // pdf.js puts a space after a ligature ("fi ner"); words rarely end in fi/fl
        let text = l.text.replace(/(fi|fl) (?=\p{Ll})/gu, '$1').replace(/\s+$/, ' ')
        // Symbol-font glyphs (the ❖ end mark) come out as private-use characters
        text = text.replace(/[-]/g, '')
        // A word broken at the line end. The PDF doesn't say if the hyphen is only for the break
        // ("Tal-mud") or part of the word ("court-mandated"); layout.joinAcross decides from the
        // issue's own vocabulary ('pdf' = ambiguous).
        let hyphen = false
        if (/\p{L}-\s*$/u.test(text)) {
            text = text.replace(/-\s*$/, '')
            hyphen = 'pdf'
        }
        return { text, font: fontIds.get(font), size: l.size, rotated: l.rotated, x: round(l.x), y: round(l.y), end: round(l.end), hyphen, endsSpace: /\s$/.test(text) }
    })
}

// Where pictures are drawn: follow the drawing transform and record each image's box
function imageBoxes(ops, height) {
    const boxes = []
    let ctm = [1, 0, 0, 1, 0, 0]
    const stack = []
    const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
    const IMAGE = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintJpegXObject, OPS.paintImageXObjectRepeat].filter(Boolean))
    for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]
        if (fn === OPS.save) stack.push(ctm)
        else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0]
        else if (fn === OPS.transform) ctm = mul(ctm, ops.argsArray[i])
        else if (fn === OPS.paintFormXObjectBegin) {
            stack.push(ctm)
            if (ops.argsArray[i]?.[0]) ctm = mul(ctm, ops.argsArray[i][0])
        } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || [1, 0, 0, 1, 0, 0]
        else if (IMAGE.has(fn)) {
            const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]])
            const xs = pts.map(p => p[0])
            const ys = pts.map(p => height - p[1])
            boxes.push({ x: round(Math.min(...xs)), y: round(Math.min(...ys)), w: round(Math.max(...xs) - Math.min(...xs)), h: round(Math.max(...ys) - Math.min(...ys)) })
        }
    }
    return boxes
}

export async function openPdf(buffer) {
    const doc = await getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false, canvasFactory: new CanvasFactory() }).promise
    const fontIds = new Map()
    const pages = []
    for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        const { width, height } = page.getViewport({ scale: 1 })
        const tc = await page.getTextContent()
        pages.push({ number: n, width, height, lines: buildLines(tc.items, height, fontIds, tc.styles), page })
    }
    return {
        pages,
        // Picture boxes on a page (only asked for on the pages that matter: it's slower)
        async images(n) {
            const p = pages[n - 1]
            return imageBoxes(await p.page.getOperatorList(), p.height)
        },
        // The page as a JPEG, `width` pixels wide
        async render(n, width = 1400) {
            const page = pages[n - 1].page
            const viewport = page.getViewport({ scale: width / pages[n - 1].width })
            const factory = new CanvasFactory()
            const cc = factory.create(Math.round(viewport.width), Math.round(viewport.height))
            await page.render({ canvasContext: cc.context, viewport, canvasFactory: factory }).promise
            const jpeg = cc.canvas.toBuffer('image/jpeg', 85)
            factory.destroy(cc)
            return jpeg
        },
        close: () => doc.destroy(),
    }
}

// scripts/import/lib/issuu.mjs
// Reads The Jewish Home's issues on Issuu without a browser:
//   - the profile pages list every issue (newest first, ~48 per page)
//   - reader3_4.json gives an issue's date and the URLs of each page's files
//   - text_info.bin is the issue's text layer: every line with its position and size
//   - each page's layer file holds the page graphics without the text, which is
//     what the photo is cropped from
import { getText, getBuffer } from './http.mjs'
import { decode, first, all, floats } from './protobuf.mjs'

export const PUBLISHER = 'jewishhome'

export function issueUrl(doc, page) {
    return `https://issuu.com/${PUBLISHER}/docs/${doc}${page ? `/${page}` : ''}`
}

// Doc names on one profile page ("five_towns_jewish_home_01.08.26", ...), in page order.
export async function listIssues(profilePage = 1) {
    const url = `https://issuu.com/${PUBLISHER}${profilePage > 1 ? `/${profilePage}` : ''}`
    const html = await getText(url)
    const seen = new Set()
    for (const [, doc] of html.matchAll(new RegExp(`"/${PUBLISHER}/docs/([^"/?#]+)`, 'g'))) seen.add(doc)
    return [...seen]
}

// An issue's files all live at addresses built from two IDs on its Issuu page.
// (Issuu's reader JSON would list them too, but it refuses newer issues.)
export async function getIssue(doc) {
    const html = (await getText(issueUrl(doc))).replace(/\\+"/g, '"')
    const ids = html.match(/"publicationId":"([0-9a-f]+)","revisionId":"(\d{12})"/)
    if (!ids) throw new Error(`Could not find the issue's IDs on ${issueUrl(doc)}`)
    const [, publicationId, revisionId] = ids
    const access = html.match(/"access":"([A-Z_]+)"/)?.[1] ?? 'UNKNOWN'
    // revisionId starts with the upload date (YYMMDD); the cover date is usually a day later
    const date = `20${revisionId.slice(0, 2)}-${revisionId.slice(2, 4)}-${revisionId.slice(4, 6)}`
    return {
        doc,
        date,
        access,
        textUri: `https://layers.isu.pub/${publicationId}/${revisionId}/text_v0/text_info.bin`,
        page: number => ({
            number,
            imageUrl: `https://image.isu.pub/${revisionId}-${publicationId}/jpg/page_${number}.jpg`,
            layersUrl: `https://layers.isu.pub/${publicationId}/${revisionId}/v2/page_${number}.bin`,
        }),
    }
}

// The issue's text: [{ number, width, height, lines: [{ text, font, size, x, y, rotated }] }].
// x/y are the line's start in page units (y grows downward); size is the font scale.
export function parseTextLayer(buf) {
    const pages = []
    for (const pageBuf of all(decode(buf), 1)) {
        const page = decode(pageBuf)
        const lines = []
        for (const lineBuf of all(page, 4)) {
            const line = decode(lineBuf)
            const text = first(line, 1)
            const matrix = first(line, 3)
            if (!text || !matrix) continue
            const [a, b, , d, x, y] = floats(matrix)
            lines.push({
                text: text.toString('utf8'),
                font: first(line, 2) ?? 0,
                size: Math.abs(a) > 1e-6 ? Math.abs(a) : Math.abs(d),
                rotated: Math.abs(a) < 1e-6 && Math.abs(b) > 1e-6,
                x,
                y,
            })
        }
        pages.push({ number: first(page, 1), width: first(page, 2), height: first(page, 3), lines })
    }
    return pages
}

export async function getTextLayer(issue) {
    try {
        return parseTextLayer(await getBuffer(issue.textUri))
    } catch (err) {
        if (err.status === 403 || err.status === 404) return null
        throw err
    }
}

// The page's graphics with the text removed (a JPEG), or null if Issuu has none.
export async function getPageGraphics(page) {
    if (!page.layersUrl) return null
    const layers = decode(await getBuffer(page.layersUrl))
    const image = first(layers, 11)
    if (!image) return null
    return { jpeg: first(decode(image), 1), width: first(layers, 4), height: first(layers, 5) }
}

export async function getPageImage(page) {
    return getBuffer(page.imageUrl)
}

// "Delving into the Daf by Rabbi Avrohom Sebrow" in the table of contents, followed by its page.
// Returns the page numbers listed for Rabbi Sebrow's column (usually one).
export function findColumnInContents(pages) {
    const found = new Set()
    for (const page of pages.slice(0, 12)) {
        page.lines.forEach((line, i) => {
            if (!/sebrow/i.test(line.text)) return
            // The number is either inside the same entry ("...Sebrow\n74") or on a line next to it
            const candidates = [line.text.match(/sebrow\s*\n\s*(\d{1,3})\s*$/i)?.[1]]
            for (const l of page.lines.slice(Math.max(0, i - 2), i + 3)) candidates.push(l.text.trim().match(/^(\d{1,3})$/)?.[1])
            for (const n of candidates) if (n && +n > 0 && +n <= pages.length) found.add(+n)
        })
    }
    return [...found]
}

// Pages whose byline is Rabbi Sebrow's ("By Rabbi Avrohom Sebrow"). This is the real
// authorship check; the table of contents is only a hint.
export function findBylinePages(pages) {
    return pages
        .filter(p => p.lines.some(l => /^\s*by\s+rabbi\s+avrohom\s+sebrow\s*$/i.test(l.text)))
        .map(p => p.number)
}

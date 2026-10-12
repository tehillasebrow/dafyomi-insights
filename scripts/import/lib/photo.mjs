// scripts/import/lib/photo.mjs
// Finds the article's photo on the page graphics (Issuu's page image without the
// text) and crops it. On that layer the photo is the only large solid block: the
// rest is white space, rules and the column logo. Only the article's own area
// is searched, so an ad elsewhere on the page is never picked.
import sharp from 'sharp'

const GRID_WIDTH = 360 // the page is analysed at this width; the crop is taken at full size

// graphics: { jpeg, width, height } from issuu.getPageGraphics
// page: { width, height } in text units; region: { left, top, right, bottom } in text units
// Returns { buffer, box, warnings } or { buffer: null, warnings }.
export async function cropPhoto(graphics, page, region) {
    const warnings = []
    const scale = graphics.width / page.width // text units -> pixels
    const grid = GRID_WIDTH / graphics.width // pixels -> grid cells

    const { data, info } = await sharp(graphics.jpeg)
        .resize({ width: GRID_WIDTH })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    const W = info.width
    const H = info.height

    // Search area: the article region, padded, in grid cells
    const area = region
        ? {
              x0: Math.max(0, Math.floor((region.left - 10) * scale * grid)),
              y0: Math.max(0, Math.floor((region.top - 10) * scale * grid)),
              x1: Math.min(W, Math.ceil((region.right + 10) * scale * grid)),
              y1: Math.min(H, Math.ceil((region.bottom + 10) * scale * grid)),
          }
        : { x0: 0, y0: 0, x1: W, y1: H }

    // Ink = anything clearly not white
    const ink = new Uint8Array(W * H)
    for (let y = area.y0; y < area.y1; y++) {
        for (let x = area.x0; x < area.x1; x++) {
            const i = (y * W + x) * info.channels
            if (Math.min(data[i], data[i + 1], data[i + 2]) < 225) ink[y * W + x] = 1
        }
    }

    // Close small gaps (light areas inside a photo) so the photo is one blob
    const grown = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!ink[y * W + x]) continue
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const yy = y + dy
                    const xx = x + dx
                    if (yy >= 0 && yy < H && xx >= 0 && xx < W) grown[yy * W + xx] = 1
                }
            }
        }
    }

    // Connected blobs, with their bounding box and how much of it is ink
    const seen = new Uint8Array(W * H)
    const blobs = []
    for (let start = 0; start < W * H; start++) {
        if (!grown[start] || seen[start]) continue
        const stack = [start]
        seen[start] = 1
        let x0 = W, y0 = H, x1 = 0, y1 = 0, filled = 0
        while (stack.length) {
            const p = stack.pop()
            const x = p % W
            const y = (p - x) / W
            if (ink[p]) filled++
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
            for (const q of [p - 1, p + 1, p - W, p + W]) {
                if (q < 0 || q >= W * H || seen[q] || !grown[q]) continue
                if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue
                seen[q] = 1
                stack.push(q)
            }
        }
        const w = x1 - x0 + 1
        const h = y1 - y0 + 1
        blobs.push({ x0, y0, w, h, area: w * h, fill: filled / (w * h) })
    }

    // A photo is big in both directions and fairly solid (not a rule or an outline)
    const photos = blobs
        .filter(b => b.w > W * 0.12 && b.h > H * 0.07 && b.area > W * H * 0.025 && b.fill > 0.2) // photos with white backgrounds fill ~30%
        .sort((a, b) => b.area - a.area)
    if (!photos.length) return { buffer: null, warnings: ['No photo found on the page'] }
    if (photos.length > 1 && photos[1].area > photos[0].area * 0.4) {
        warnings.push(`Page has ${photos.length} pictures: used the largest, check it's the right one`)
    }

    const best = photos[0]
    const toPx = v => Math.round(v / grid)
    const inset = 3 // trim the closing margin and any edge blur
    const box = {
        left: Math.max(0, toPx(best.x0 + 2) + inset),
        top: Math.max(0, toPx(best.y0 + 2) + inset),
        width: Math.min(graphics.width, toPx(best.w - 4)) - inset * 2,
        height: Math.min(graphics.height, toPx(best.h - 4)) - inset * 2,
    }
    box.width = Math.min(box.width, graphics.width - box.left)
    box.height = Math.min(box.height, graphics.height - box.top)

    const buffer = await sharp(graphics.jpeg)
        .extract(box)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
    return { buffer, box, warnings }
}

// scripts/photos/pick.mjs
// Saves one candidate from photos:find as the article's picture.
//
//   npm run photos:pick -- <folder> <number> [--crop] [--position top|bottom|left|right|centre]
//
// Writes stock.jpg in the article's folder and sets "photo": "stock.jpg",
// "photo_credit": { author, license, license_url, source_url } and "photo_changed": true
// (photos:apply uploads it). --crop trims a tall or very wide photo to 3:2.
// --alt saves it as alt.jpg / "photo_alt" instead, an alternative for the site owner to
// choose against the newspaper's own photo (photos:choose); the photo shown doesn't change.
import fs from 'node:fs'
import path from 'node:path'
import { PHOTOS_DIR, STOCK, articleFolders, findFolder, download, finishPhoto, readJson, writeJson } from './lib.mjs'

const args = process.argv.slice(2)
const [key, num] = args.filter(a => !a.startsWith('--') && !['top', 'bottom', 'left', 'right', 'centre', 'center'].includes(a))
const crop = args.includes('--crop')
const alt = args.includes('--alt')
const position = args.includes('--position') ? args[args.indexOf('--position') + 1] : undefined
if (!key || num == null) {
    console.error('usage: npm run photos:pick -- <folder> <number> [--crop] [--position top]')
    process.exit(1)
}

const { dir, file, article } = findFolder(key)
const candidates = readJson(path.join(PHOTOS_DIR, 'candidates', `${key}.json`), null)
if (!candidates) throw new Error(`no candidates for ${key}: run photos:find first`)
const c = candidates[Number(num)]
if (!c) throw new Error(`no candidate ${num} (there are ${candidates.length})`)
const usedBy = articleFolders().find(f => f.key !== key && ((f.article.photo === STOCK && f.article.photo_credit?.source_url === c.source_url) || f.article.photo_alt?.credit?.source_url === c.source_url))
if (usedBy) {
    console.error(`candidate ${num} is already the photo of ${usedBy.key}: pick a different one`)
    process.exit(1)
}

const buffer = await finishPhoto(await download(c.full), { crop: crop || position != null, position })
const credit = c.needsCredit
    ? { author: c.author || 'Unknown', license: c.license, license_url: c.license_url, source_url: c.source_url }
    : { author: c.author || null, license: 'Public domain', license_url: c.license_url, source_url: c.source_url }
if (alt) {
    fs.writeFileSync(path.join(dir, 'alt.jpg'), buffer)
    writeJson(file, { ...article, photo_alt: { file: 'alt.jpg', credit } })
} else {
    fs.writeFileSync(path.join(dir, STOCK), buffer)
    writeJson(file, { ...article, photo: STOCK, photo_generated: false, photo_credit: credit, photo_changed: true })
}
console.log(`${key}: saved ${alt ? 'alt.jpg' : STOCK} from ${c.source_url}`)

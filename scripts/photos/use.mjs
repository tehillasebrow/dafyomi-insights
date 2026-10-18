// scripts/photos/use.mjs
// Uses pictures the site owner found themselves (e.g. a photo of a gadol from Google).
// Save each picture in data/photos/owner/ named after the article's folder, e.g.
// data/photos/owner/2025-04-10-questions-and-answers-from-harav-chaim-kanievsky.jpg
// (.jpg, .jpeg, .png or .webp), then:
//
//   npm run photos:use
//
// Each becomes that article's stock.jpg with no credit line, marked "photo_changed"
// (photos:apply puts it on the site). The file in owner/ is moved to owner/used/.
import fs from 'node:fs'
import path from 'node:path'
import { PHOTOS_DIR, STOCK, findFolder, finishPhoto, writeJson } from './lib.mjs'

const dir = path.join(PHOTOS_DIR, 'owner')
fs.mkdirSync(path.join(dir, 'used'), { recursive: true })
const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
if (!files.length) console.log(`No pictures waiting in ${dir}`)
for (const name of files) {
    const key = name.replace(/\.\w+$/, '')
    try {
        const folder = findFolder(key)
        fs.writeFileSync(path.join(folder.dir, STOCK), await finishPhoto(fs.readFileSync(path.join(dir, name))))
        writeJson(folder.file, { ...folder.article, photo: STOCK, photo_generated: false, photo_credit: null, photo_changed: true })
        fs.renameSync(path.join(dir, name), path.join(dir, 'used', name))
        console.log(`${key}: using ${name}`)
    } catch (err) {
        console.error(`${name}: ${err.message}`)
    }
}

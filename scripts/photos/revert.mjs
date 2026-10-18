// scripts/photos/revert.mjs
// Undoes the AI sharpening of a newspaper photo (photos:upscale) when it made things
// worse, e.g. garbled the lettering in a sign or a cartoon, or made a face look waxy.
//
//   npm run photos:revert -- <folder> [<folder> ...]
//
// Puts photo-original.jpg back and marks the article "photo_sharpen_rejected", so
// upscale.mjs won't sharpen it again.
import fs from 'node:fs'
import path from 'node:path'
import { findFolder, writeJson } from './lib.mjs'

for (const key of process.argv.slice(2)) {
    const { dir, file, article } = findFolder(key)
    const original = path.join(dir, 'photo-original.jpg')
    if (!fs.existsSync(original)) {
        console.error(`${key}: no photo-original.jpg, nothing to undo`)
        continue
    }
    fs.copyFileSync(original, path.join(dir, article.photo))
    // If only the sharpening changed it, the live site already has this original
    writeJson(file, { ...article, photo_upscaled: false, photo_sharpen_rejected: true, photo_changed: Boolean(article.photo_recut) })
    console.log(`${key}: back to the original`)
}

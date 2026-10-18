// scripts/photos/upscale.mjs
// Sharpens the newspaper's own small photos with a free AI upscaler (Real-ESRGAN,
// run on this PC), so they don't look blurry on the article page.
//
//   npm run photos:upscale                  dry run: lists the photos it would sharpen
//   npm run photos:upscale -- --write       sharpens them
//
// Needs realesrgan-ncnn-vulkan.exe: set REALESRGAN to its path, or unzip it into
// %LOCALAPPDATA%\realesrgan (github.com/xinntao/Real-ESRGAN/releases, the -windows.zip).
// The original is kept as photo-original.jpg; the article is marked "photo_upscaled"
// and "photo_changed" (photos:apply uploads it).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { articleFolders, writeJson } from './lib.mjs'

const write = process.argv.includes('--write')
const MIN_WIDTH = 1000 // photos narrower than this get sharpened
const ORIGINAL = 'photo-original.jpg'
const exe = process.env.REALESRGAN || path.join(process.env.LOCALAPPDATA || '', 'realesrgan', 'realesrgan-ncnn-vulkan.exe')

const targets = []
for (const f of articleFolders()) {
    const a = f.article
    if (a.review?.status !== 'published' || a.photo_generated || !a.photo || a.photo === 'stock.jpg' || a.photo_upscaled || a.photo_sharpen_rejected) continue
    const file = path.join(f.dir, a.photo)
    if (!fs.existsSync(file)) continue
    const { width, height } = await sharp(file).metadata()
    if (width < MIN_WIDTH) targets.push({ ...f, photoFile: file, width, height })
}

if (!write) {
    for (const t of targets) console.log(`would sharpen ${t.key}  ${t.width}x${t.height}`)
    console.log(`\n${targets.length} photo(s) would be sharpened. Add --write to do it.`)
    process.exit(0)
}
if (!fs.existsSync(exe)) throw new Error(`Real-ESRGAN not found at ${exe}`)

const tmp = path.join(os.tmpdir(), 'dafyomi-upscale.png')
for (const [i, t] of targets.entries()) {
    const original = path.join(t.dir, ORIGINAL)
    if (!fs.existsSync(original)) fs.copyFileSync(t.photoFile, original)
    execFileSync(exe, ['-i', original, '-o', tmp, '-n', 'realesrgan-x4plus'], { stdio: 'ignore' })
    const out = await sharp(tmp).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    fs.writeFileSync(t.photoFile, out)
    writeJson(t.file, { ...t.article, photo_upscaled: true, photo_changed: true })
    console.log(`${i + 1}/${targets.length} sharpened ${t.key}  ${t.width}x${t.height}`)
}
fs.rmSync(tmp, { force: true })

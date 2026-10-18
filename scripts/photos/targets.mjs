// scripts/photos/targets.mjs
// Lists the live articles that still have no real picture (none, or a plain title card),
// so each can be given a free-license photo with photos:find / photos:pick.
//
//   npm run photos:targets
//
// Articles typed in by hand (not from the importer) get a folder in data/photos/manual/.
// Writes data/photos/targets.json: [{ folder, title, masechta, daf, tags, opening }].
import fs from 'node:fs'
import path from 'node:path'
import { readClient } from '../lib/stories.mjs'
import { PHOTOS_DIR, articleFolders, writeJson } from './lib.mjs'

const db = readClient()
const { data: live, error } = await db.from('articles').select('id, slug, title, masechta, daf, tags, content, image_url, source_url').is('image_url', null)
if (error) throw error
for (const a of live) {
    if (a.source_url) continue // a staged article: it has its own folder
    const file = path.join(PHOTOS_DIR, 'manual', a.slug, 'article.json')
    if (fs.existsSync(file)) continue
    writeJson(file, { id: a.id, slug: a.slug, title: a.title, masechta: a.masechta, daf: a.daf, tags: a.tags, content: a.content, photo: null, review: { status: 'published' } })
}

const targets = []
for (const { key, dir, article, manual } of articleFolders()) {
    if (article.review?.status !== 'published') continue
    const hasStock = article.photo === 'stock.jpg' && fs.existsSync(path.join(dir, 'stock.jpg'))
    const needs = manual ? !hasStock : article.photo_generated || !article.photo
    if (!needs || hasStock) continue
    targets.push({
        folder: key,
        title: article.title,
        masechta: article.masechta ?? null,
        daf: article.daf ?? null,
        tags: article.tags ?? [],
        opening: String(article.content ?? '').replace(/\s+/g, ' ').slice(0, 700),
    })
}
writeJson(path.join(PHOTOS_DIR, 'targets.json'), targets)
console.log(`${targets.length} article(s) need a photo: ${path.join(PHOTOS_DIR, 'targets.json')}`)

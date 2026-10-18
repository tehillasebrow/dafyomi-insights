// scripts/photos/apply.mjs
// Puts changed pictures (new free-license photos from photos:pick, sharpened photos from
// photos:upscale) on the live site: uploads each one and points its article at it.
//
//   npm run photos:apply                  dry run: lists what would change
//   npm run photos:apply -- --write       uploads and updates the live articles
//
// Only published articles marked "photo_changed" are touched. Run the migration
// supabase/migrations/20261013100000_image_credit.sql first, for the credit lines.
import path from 'node:path'
import { writeClient, revalidateSite } from '../lib/stories.mjs'
import { articleFolders, uploadPhoto, writeJson } from './lib.mjs'

const write = process.argv.includes('--write')
const db = writeClient()

const changed = articleFolders().filter(f => f.article.review?.status === 'published' && f.article.photo_changed && f.article.photo)
if (!write) {
    for (const f of changed) console.log(`would update ${f.key}  (${f.article.photo}${f.article.photo_credit ? `, credit: ${f.article.photo_credit.author}` : ''})`)
    console.log(`\n${changed.length} article(s) would get their new picture. Add --write to do it.`)
    process.exit(0)
}

const { error: columnErr } = await db.from('articles').select('image_credit').limit(1)
if (columnErr) throw new Error(`articles.image_credit is missing: run supabase/migrations/20261013100000_image_credit.sql in Supabase first (${columnErr.message})`)

let done = 0
const failed = []
for (const { key, dir, file, article, manual } of changed) {
    try {
        const keyBase = manual ? `manual/${key}` : `imports/${article.source}/${key}`
        const image_url = await uploadPhoto(db, keyBase, path.join(dir, article.photo))
        const update = { image_url, image_credit: article.photo_credit ?? null }
        const query = db.from('articles').update(update)
        const { data, error } = await (manual ? query.eq('id', article.id) : query.eq('source_url', article.source_url)).select('id')
        if (error) throw new Error(error.message)
        if (!data?.length) throw new Error('article not found on the site')
        writeJson(file, { ...article, photo_changed: false })
        done++
        console.log(`updated ${key}`)
    } catch (err) {
        failed.push(key)
        console.error(`FAILED ${key}: ${err.message}`)
    }
}
console.log(`\n${done} article(s) updated${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}.`)
if (done) await revalidateSite()

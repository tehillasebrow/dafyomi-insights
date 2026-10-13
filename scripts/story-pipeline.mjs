// The whole job in one command, for a nightly schedule or the end of an import
// script: export new articles → Claude Code drafts the stories → check and
// publish them → refresh the site. Does nothing (and uses no Claude usage)
// when there are no new articles.
//
//   npm run stories:pipeline
//   npm run stories:pipeline -- --limit 25     # cap articles per run
//
// Set AUTO_PUBLISH=false in .env.local to stop after drafting, so you can
// review data/stories/ and run `npm run stories:publish` yourself.
import { exportArticles, publishDrafts, revalidateSite, parseArgs, log } from './lib/stories.mjs'
import { runClaude } from './lib/claude.mjs'

const args = parseArgs()
const limit = args.limit ?? process.env.STORY_PIPELINE_LIMIT ?? 25

try {
    // 1. Export
    const count = await exportArticles({ limit })
    if (!count) {
        log('Pipeline: no new articles')
        process.exit(0)
    }
    log(`Pipeline: ${count} new article(s) exported`)

    // 2. Claude Code drafts the stories. It may only read, and write inside data/.
    runClaude('/extract-stories', ['Skill', 'Read', 'Glob', 'Grep', 'Edit(data/**)'])

    // 3. Check and publish
    if (process.env.AUTO_PUBLISH === 'false') {
        log('Pipeline: drafts ready in data/stories/ (AUTO_PUBLISH=false, so nothing published)')
        process.exit(0)
    }
    const result = await publishDrafts()
    log(`Pipeline: ${count} article(s) → ${result.stories} stor${result.stories === 1 ? 'y' : 'ies'} published, ${result.review} need review`)

    // 4. Refresh the site
    if (result.published) await revalidateSite()
} catch (err) {
    log(`Pipeline FAILED: ${err.message}`)
    process.exit(1)
}

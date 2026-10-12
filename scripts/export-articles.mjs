// Writes articles that haven't been split into stories yet to data/articles/,
// for Claude Code's /extract-stories to read. Read-only: uses the anon key.
//
//   npm run stories:export                       # only new articles
//   npm run stories:export -- --all              # every article
//   npm run stories:export -- --masechta Pesachim --limit 20
import { exportArticles, parseArgs, ARTICLES_DIR } from './lib/stories.mjs'

const args = parseArgs()
const count = await exportArticles({
    all: Boolean(args.all),
    masechta: args.masechta,
    article: args.article,
    limit: args.limit,
})
console.log(count
    ? `Exported ${count} article${count === 1 ? '' : 's'} to ${ARTICLES_DIR}\nNext: run /extract-stories in Claude Code.`
    : 'No articles need stories.')

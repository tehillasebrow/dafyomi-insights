// Checks Claude's drafts in data/stories/ against the articles and publishes
// the good ones to Supabase. Problem drafts go to data/stories/needs-review/
// with the reasons; published drafts are moved to data/stories/published/.
// Safe to run again: stories are matched by slug and updated in place.
//
//   npm run stories:publish -- --dry-run       # check only, change nothing
//   npm run stories:publish
//   npm run stories:publish -- --file data/stories/needs-review/x.json
import { publishDrafts, revalidateSite, parseArgs, log } from './lib/stories.mjs'

const args = parseArgs()
const dryRun = Boolean(args['dry-run'])
const result = await publishDrafts({ dryRun, file: args.file })

log(`${dryRun ? '[dry run] ' : ''}${result.published} article(s) → ${result.stories} stor${result.stories === 1 ? 'y' : 'ies'} ${dryRun ? 'ready' : 'published'}, ${result.review} need review`)
if (!dryRun && result.published) await revalidateSite()

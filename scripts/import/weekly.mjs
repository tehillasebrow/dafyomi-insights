// The weekly run (GitHub Actions, .github/workflows/weekly-import.yml):
//   1. checks The Jewish Home's newest issues for Rabbi Sebrow's column
//   2. publishes it if nothing looks wrong
//   3. writes data/import/alert.md when something needs a person: the workflow turns
//      that file into a GitHub issue, which emails the site owner
//
//   npm run import:weekly                    normal run
//   npm run import:weekly -- --final         also alert if no new column was found
//                                            (the Friday run; the issue is often uploaded late)
//   npm run import:weekly -- --dry-run       finds and stages, but publishes nothing
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, readClient } from '../lib/stories.mjs'
import { listIssues, getIssue, issueUrl } from './lib/issuu.mjs'
import { processIssue } from './jewishhome.mjs'
import { publish } from './publish.mjs'
import { IMPORT_DIR, listStaged, seriousWarnings, writeReviewCsv } from './lib/staging.mjs'

const ALERT_FILE = path.join(IMPORT_DIR, 'alert.md')
const CHECK_ISSUES = 3 // the newest few issues; anything older was handled by earlier runs

const args = parseArgs()
const problems = []
const notes = []

fs.rmSync(ALERT_FILE, { force: true })

try {
    // Issues already on the site are skipped, so no saved state is needed between runs
    const { data: rows, error } = await readClient().from('articles').select('source_url').eq('source', 'jewishhome')
    if (error) throw new Error(`Could not read the site's articles: ${error.message}`)
    const done = new Set(rows.map(r => r.source_url.replace(/\/\d+$/, '')))

    const docs = (await listIssues(1)).slice(0, CHECK_ISSUES)
    if (!docs.length) throw new Error('Could not read the list of issues on issuu.com/jewishhome (the page may have changed)')

    let newColumns = 0
    const stagedNow = new Set()
    for (const doc of docs) {
        if (done.has(issueUrl(doc))) continue
        console.log(`Checking ${doc}`)
        const result = await processIssue(doc)
        if (result.status === 'error') problems.push(`**${doc}**: ${result.error}`)
        for (const s of result.staged || []) if (s.dir) stagedNow.add(s.dir)
        if (result.status === 'article') newColumns += result.staged.filter(s => s.dir).length
        for (const s of result.staged || []) if (s.error) problems.push(`**${doc}** page ${s.page}: ${s.error}`)
    }

    if (!newColumns && args.final) {
        const newest = docs[0]
        const uploaded = Date.parse((await getIssue(newest)).date + 'T00:00:00Z')
        if (Date.now() - uploaded > 9 * 86400000) {
            problems.push(`No new issue of The Jewish Home has been uploaded to Issuu since ${new Date(uploaded).toISOString().slice(0, 10)}. Check [issuu.com/jewishhome](https://issuu.com/jewishhome): if they stopped using Issuu, the importer needs a new source.`)
        } else if (!done.has(issueUrl(newest))) {
            problems.push(`No new "Delving into the Daf" column was found this week. Newest issue checked: [${newest}](${issueUrl(newest)}). This is normal for a Yom Tov week or if he took a week off; if the column is in the paper, it may have a different byline or layout.`)
        }
    }

    // Publish what's clean; list what's held back
    const result = await publish({ dryRun: Boolean(args['dry-run']), clean: true, only: stagedNow })
    for (const f of result.failed) problems.push(`Publishing **${f.title}** failed: ${f.error}`)
    for (const d of result.duplicates) notes.push(`**${d.title}** is already on the site (added by hand), so it was not added again.`)
    for (const { dir, article } of listStaged('jewishhome')) {
        if (!stagedNow.has(dir)) continue
        const serious = seriousWarnings(article)
        if (article.review?.status === 'pending' && serious.length) {
            problems.push(`**${article.title}** (${article.published_at.slice(0, 10)}) was found but held back for a check:\n${serious.map(w => `  - ${w}`).join('\n')}\n  - [See it in the paper](${article.source_url})`)
        }
    }
    for (const t of result.published) console.log(`Published: ${t}`)
} catch (err) {
    problems.push(`The weekly import stopped with an error: ${err.message}`)
}

writeReviewCsv()
if (problems.length) {
    const body = [
        'The weekly newspaper import needs a look.',
        '',
        ...problems.map(p => `- ${p}`),
        ...(notes.length ? ['', 'Notes:', ...notes.map(n => `- ${n}`)] : []),
        '',
        'To fix: open this project in Claude Code and say **"review the newspaper import"**. Close this issue when it\'s handled.',
    ].join('\n')
    fs.mkdirSync(IMPORT_DIR, { recursive: true })
    fs.writeFileSync(ALERT_FILE, body + '\n')
    console.log(`\n${body}`)
} else {
    console.log('\nAll good: nothing needs attention.')
}

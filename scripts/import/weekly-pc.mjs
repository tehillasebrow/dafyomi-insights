// The weekly run on the owner's PC (Windows Task Scheduler, scripts/register-weekly.ps1).
// Unlike weekly.mjs (GitHub, no Claude), this one has Claude Code review each new column
// the way the backfill was reviewed, so it goes up with its topics, subtopics and stories:
//   1. checks The Jewish Home's newest issues for Rabbi Sebrow's column
//   2. Claude Code runs /review-import on it: text against the page, title, daf,
//      topics and subtopics, stories, photo. Anything doubtful is set to "held".
//   3. a free-license photo (chosen in step 2) or, failing that, a title card for a column with no photo
//   4. publishes what Claude approved (the site refreshes and the admin gets the
//      mailing-list preview email)
//   5. opens a GitHub issue (which emails the owner) when something needs a person
//
//   npm run import:weekly-pc                  normal run
//   npm run import:weekly-pc -- --final       also alert if no new column was found
//                                            (automatic from Friday on: the issue is often uploaded late)
//   npm run import:weekly-pc -- --dry-run     finds, stages and reviews, but publishes nothing
//   npm run import:weekly-pc -- --only data/import/jewishhome/articles/<folder>
//                                            reviews and publishes one staged folder
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseArgs, readClient, ROOT, log } from '../lib/stories.mjs'
import { runClaude } from '../lib/claude.mjs'
import { listIssues, getIssue, issueUrl } from './lib/issuu.mjs'
import { processIssue } from './jewishhome.mjs'
import { publish } from './publish.mjs'
import { listStaged, writeReviewCsv } from './lib/staging.mjs'

const CHECK_ISSUES = 3 // the newest few issues; anything older was handled by earlier runs

const args = parseArgs()
const dryRun = Boolean(args['dry-run'])
const final = Boolean(args.final) || [5, 6, 0].includes(new Date().getDay()) // Friday to Sunday
const problems = []
const notes = []
const say = msg => log(`Weekly: ${msg}`)

const REVIEW_PROMPT = dirs => `/review-import

This is the unattended weekly run: nobody is watching, so never ask a question. Review ONLY these newly imported folders, following the skill fully (text against page.jpg, title, paragraphs and headings, daf, photo, byline, then tags with topics and subtopics, refs and stories):

${dirs.map(d => `- ${path.relative(ROOT, d).replace(/\\/g, '/')}`).join('\n')}

Rules for the unattended run:
- Set review.status to "approved" or "fixed" only when you are confident the article matches the printed page and the daf is clear. These are published automatically right after you finish.
- If anything is doubtful (text you can't match to the page, a missing piece, an unclear daf, a possible reprint of an older column, anything else a person should decide), set review.status to "held" and explain in review.notes in one or two plain-English sentences what the site owner should check.
- Not his byline: "rejected", as the skill says.
- Only edit files inside the folders listed above, plus data/topics.json to add new subtopics. The site owner approved adding them without asking, so in this run a new subtopic goes straight into its topic's subtopics in data/topics.json (as {"name", "description"}, following the skill's subtopic rules) AND into the article's tags; don't use review.new_subtopics. In data/topics.json only add subtopics: never change or remove anything else, and re-read it right before editing. Never edit data/people-vocabulary.json: put a new name in review.new_people. A missing main topic goes in review.new_topics.
- Don't run import:reprints, import:publish or anything that touches the website. Run npm run import:check-seo at the end and fix what it reports for these folders.`

// Opens a GitHub issue, which emails the site owner. Falls back to logs/weekly-alert.md.
function alert(body) {
    const title = `Newspaper import needs a look (${new Date().toISOString().slice(0, 10)})`
    try {
        try { execFileSync('gh', ['label', 'create', 'import-alert', '--color', 'D93F0B', '--description', 'Weekly newspaper import needs a look'], { cwd: ROOT, stdio: 'ignore' }) } catch {}
        execFileSync('gh', ['issue', 'create', '--title', title, '--body', body, '--label', 'import-alert', '--assignee', '@me'], { cwd: ROOT, stdio: 'inherit' })
    } catch (err) {
        say(`could not open a GitHub issue (${err.message}); see logs/weekly-alert.md`)
    }
    fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(ROOT, 'logs', 'weekly-alert.md'), `# ${title}\n\n${body}\n`)
}

// A new subtopic only gets its page once the site is rebuilt with the new data/topics.json:
// commit that one file and push it, and Vercel redeploys. (The site owner approved new
// subtopics going up without asking, 2026-10-13.)
function shipTopics() {
    const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' })
    const added = (git('diff', '--', 'data/topics.json').match(/^\+\s*"name"/gm) ?? []).length
    if (!added) return
    // Someone is mid-way through changing how topics work: don't ship half of it
    if (git('status', '--porcelain', '--', 'app/lib/topics.js', 'scripts/topics').trim()) {
        notes.push('New subtopics were added to data/topics.json but not uploaded, because other topic code has unsaved changes. They go up with the next upload.')
        return
    }
    try {
        git('commit', '-m', 'Weekly import: new subtopics', '--', 'data/topics.json')
        try { git('push') } catch {
            git('pull', '--rebase', '--autostash')
            git('push')
        }
        say('new subtopics committed and pushed; the site redeploys')
    } catch (err) {
        notes.push(`New subtopics were added to data/topics.json but couldn't be uploaded to GitHub (${err.message.split('\n')[0]}), so their pages won't appear until it's pushed.`)
    }
}

try {
    // Issues already on the site, or already staged here (e.g. held last week), are skipped
    const { data: rows, error } = await readClient().from('articles').select('source_url').eq('source', 'jewishhome')
    if (error) throw new Error(`Could not read the site's articles: ${error.message}`)
    const issueOf = url => url.replace(/\/\d+$/, '')
    const done = new Set(rows.filter(r => r.source_url).map(r => issueOf(r.source_url)))
    for (const { article } of listStaged('jewishhome')) if (article.source_url) done.add(issueOf(article.source_url))

    // --only <folder>: skip Issuu and review/publish one staged folder (a re-run, or a test)
    const docs = args.only ? [] : (await listIssues(1)).slice(0, CHECK_ISSUES)
    if (!args.only && !docs.length) throw new Error('Could not read the list of issues on issuu.com/jewishhome (the page may have changed)')

    const stagedNow = new Set(args.only ? [path.resolve(ROOT, args.only)] : [])
    for (const doc of docs) {
        if (done.has(issueUrl(doc))) continue
        say(`checking ${doc}`)
        const result = await processIssue(doc)
        if (result.status === 'error') problems.push(`**${doc}**: ${result.error}`)
        for (const s of result.staged || []) {
            if (s.dir) stagedNow.add(s.dir)
            if (s.error) problems.push(`**${doc}** page ${s.page}: ${s.error}`)
        }
    }

    if (!stagedNow.size) {
        say('no new column')
        if (final) {
            const newest = docs[0]
            const uploaded = Date.parse((await getIssue(newest)).date + 'T00:00:00Z')
            if (Date.now() - uploaded > 9 * 86400000) {
                problems.push(`No new issue of The Jewish Home has been uploaded to Issuu since ${new Date(uploaded).toISOString().slice(0, 10)}. Check [issuu.com/jewishhome](https://issuu.com/jewishhome): if they stopped using Issuu, the importer needs a new source.`)
            } else if (!done.has(issueUrl(newest))) {
                problems.push(`No new "Delving into the Daf" column was found this week. Newest issue checked: [${newest}](${issueUrl(newest)}). This is normal for a Yom Tov week or if he took a week off; if the column is in the paper, it may have a different byline or layout.`)
            }
        }
    } else {
        // Claude Code reviews them; it may only read, write inside data/ and run the checks
        say(`${stagedNow.size} new column(s); Claude Code is reviewing`)
        runClaude(REVIEW_PROMPT([...stagedNow]), [
            'Skill', 'Read', 'Glob', 'Grep', 'Edit(data/import/**)', 'Edit(data/topics.json)',
            'Bash(npm run import:check-seo*)', 'Bash(npm run topics:check*)', 'Bash(npm run import:preview*)',
            'Bash(npm run -s photos:find*)', 'Bash(npm run -s photos:pick*)', 'Bash(npm run photos:find*)', 'Bash(npm run photos:pick*)',
        ])

        if (!dryRun) shipTopics()

        // A title card for anything without a usable photo (never replaces a real one)
        execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/import/title-cards.mjs', '--write'], { cwd: ROOT, stdio: 'inherit' })

        // Publish what Claude approved; list what it held back
        const result = await publish({ dryRun, only: stagedNow })
        for (const t of result.published) say(`${dryRun ? 'would publish' : 'published'}: ${t}`)
        for (const f of result.failed) problems.push(`Publishing **${f.title}** failed: ${f.error}`)
        for (const d of result.duplicates) notes.push(`**${d.title}** is already on the site (added by hand), so it was not added again.`)
        for (const { dir, article } of listStaged('jewishhome')) {
            if (!stagedNow.has(dir)) continue
            const names = list => (list ?? []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean)
            const proposed = names(article.review?.new_topics)
            if (proposed.length) notes.push(`**${article.title}** could use new main topics not on the list yet: ${proposed.join(', ')}. Say "add the new topics from the weekly import" in Claude Code if you want them.`)
            const status = article.review?.status || 'pending'
            if (status === 'approved' || status === 'fixed' || status === 'published') continue
            const why = article.review?.notes || 'Claude Code did not finish reviewing it.'
            problems.push(`**${article.title}** (${article.published_at.slice(0, 10)}) was ${status === 'rejected' ? 'not published' : 'held back'}: ${why}\n  - [See it in the paper](${article.source_url})`)
        }
    }
} catch (err) {
    problems.push(`The weekly import stopped with an error: ${err.message}`)
}

writeReviewCsv()
if (problems.length || notes.length) {
    const body = [
        'The weekly newspaper import needs a look.',
        '',
        ...problems.map(p => `- ${p}`),
        ...(notes.length ? ['', 'Notes:', ...notes.map(n => `- ${n}`)] : []),
        '',
        'To fix: open this project in Claude Code and say **"review the newspaper import"**. Close this issue when it\'s handled.',
    ].join('\n')
    say(body)
    if (!dryRun) alert(body)
    if (problems.length) process.exitCode = 1
} else {
    say('all good, nothing needs attention')
}

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
import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { exportArticles, publishDrafts, revalidateSite, parseArgs, log, ROOT } from './lib/stories.mjs'

const args = parseArgs()
const limit = args.limit ?? process.env.STORY_PIPELINE_LIMIT ?? 25

// Claude Code: CLAUDE_BIN, else `claude` on PATH, else the copy bundled with
// the VS Code extension (newest version first).
function findClaude() {
    if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
    try {
        const found = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' })
            .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        const exe = found.find(f => /\.exe$/i.test(f)) ?? found[0]
        if (exe) return exe
    } catch {}
    const extensions = path.join(os.homedir(), '.vscode', 'extensions')
    const bundled = (fs.existsSync(extensions) ? fs.readdirSync(extensions) : [])
        .filter(d => d.startsWith('anthropic.claude-code-'))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map(d => path.join(extensions, d, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude'))
        .find(f => fs.existsSync(f))
    if (bundled) return bundled
    throw new Error('Claude Code not found. Install it (https://claude.com/claude-code) or set CLAUDE_BIN in .env.local.')
}

try {
    // 1. Export
    const count = await exportArticles({ limit })
    if (!count) {
        log('Pipeline: no new articles')
        process.exit(0)
    }
    log(`Pipeline: ${count} new article(s) exported`)

    // 2. Claude Code drafts the stories. It may only read, and write inside data/.
    const bin = findClaude()
    const claudeArgs = [
        '-p', '/extract-stories',
        '--allowedTools', 'Skill', 'Read', 'Glob', 'Grep', 'Write(data/**)', 'Edit(data/**)',
    ]
    // .cmd / shell-script installs need a shell; quote each argument for it
    const needsShell = !/\.exe$/i.test(bin) && process.platform === 'win32'
    const claude = needsShell
        ? spawnSync(`"${bin}" ${claudeArgs.map(a => `"${a}"`).join(' ')}`, { cwd: ROOT, stdio: 'inherit', shell: true, timeout: 60 * 60 * 1000 })
        : spawnSync(bin, claudeArgs, { cwd: ROOT, stdio: 'inherit', timeout: 60 * 60 * 1000 })
    if (claude.error || claude.status !== 0) {
        throw new Error(`Claude Code failed (${claude.error?.message ?? `exit ${claude.status}`}). Is it logged in? Open Claude Code once and sign in.`)
    }

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

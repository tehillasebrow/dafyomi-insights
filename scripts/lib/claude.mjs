// Runs Claude Code headlessly (`claude -p`) on the owner's subscription: no API key.
// Used by the nightly story pipeline and the weekly newspaper import.
import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from './stories.mjs'

// Claude Code: CLAUDE_BIN, else `claude` on PATH, else the copy bundled with
// the VS Code extension (newest version first).
export function findClaude() {
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

// Runs one prompt with only the listed tools allowed. Throws if Claude Code fails.
export function runClaude(prompt, allowedTools, { timeoutMinutes = 60 } = {}) {
    const bin = findClaude()
    const claudeArgs = ['-p', prompt, '--allowedTools', ...allowedTools]
    // .cmd / shell-script installs need a shell; quote each argument for it
    const needsShell = !/\.exe$/i.test(bin) && process.platform === 'win32'
    const options = { cwd: ROOT, stdio: 'inherit', timeout: timeoutMinutes * 60 * 1000 }
    const claude = needsShell
        ? spawnSync(`"${bin}" ${claudeArgs.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, { ...options, shell: true })
        : spawnSync(bin, claudeArgs, options)
    if (claude.error || claude.status !== 0) {
        throw new Error(`Claude Code failed (${claude.error?.message ?? `exit ${claude.status}`}). Is it logged in? Open Claude Code once and sign in.`)
    }
}

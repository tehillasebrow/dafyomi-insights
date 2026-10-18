// Downloads every copy of the old 5tjt.com/pdfs/ printed issues (2006–2010) the Internet Archive kept.
// Runs on GitHub (.github/workflows/oldpdfs-5tjt.yml). Output: data/import/5tjt/raw/pdfs/
import fs from 'node:fs'
import path from 'node:path'
const OUT = path.resolve(import.meta.dirname, '..', '..', 'data', 'import', '5tjt', 'raw', 'pdfs')
fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function get(url, binary) {
    for (let i = 1; i <= 4; i++) {
        try {
            const r = await fetch(url, { headers: { 'user-agent': 'dafyomiinsights.com archive import (one-time)' } })
            if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : r.text()
            if (r.status === 404) return null
        } catch {}
        await sleep(5000 * i)
    }
    return null
}
const found = []
for (const prefix of ['5tjt.com/pdfs/', '5tjt.com/PDFs/', '5tjt.com/pdf/', '5tjt.com/issues/', '5tjt.com/archive/']) {
    const text = (await get(`https://web.archive.org/cdx/search/cdx?url=${prefix}&matchType=prefix&fl=original,timestamp,statuscode,mimetype,length&collapse=urlkey&limit=5000`)) || ''
    const rows = text.split('\n').filter(Boolean).map(l => l.split(' '))
    console.log(`${prefix}: ${rows.length} files`)
    for (const [original, timestamp, status, mime, length] of rows) {
        console.log(`  ${timestamp} ${status} ${mime} ${length} ${original}`)
        found.push({ original, timestamp, status, mime, length })
    }
}
for (const f of found) {
    if (!/pdf/i.test(f.original + f.mime)) continue
    // Any capture that worked, not only the first one listed
    const caps = ((await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(f.original)}&fl=timestamp,statuscode&filter=statuscode:200`)) || '').split('\n').filter(Boolean)
    for (const line of caps) {
        const ts = line.split(' ')[0]
        const buf = await get(`https://web.archive.org/web/${ts}id_/${f.original}`, true)
        if (buf && buf.length > 50000 && buf.subarray(0, 4).toString() === '%PDF') {
            const name = f.original.split('/').pop()
            fs.writeFileSync(path.join(OUT, name), buf)
            console.log(`saved ${name} (${Math.round(buf.length / 1e6)} MB) from ${ts}`)
            f.saved = name
            break
        }
        await sleep(1000)
    }
}
fs.writeFileSync(path.join(OUT, 'list.json'), JSON.stringify(found, null, 1))
console.log(`Saved ${found.filter(f => f.saved).length} PDFs`)

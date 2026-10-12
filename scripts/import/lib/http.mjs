// scripts/import/lib/http.mjs
// Polite fetching for the importers: one request at a time with a pause between
// them, a few retries on network errors and 5xx, and a clear error otherwise.

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

let delayMs = 1000
let lastRequest = 0

export function setDelay(ms) {
    delayMs = ms
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function request(url, { retries = 3 } = {}) {
    for (let attempt = 1; ; attempt++) {
        const wait = lastRequest + delayMs - Date.now()
        if (wait > 0) await sleep(wait)
        lastRequest = Date.now()
        try {
            const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
            if (res.ok) return res
            if (res.status < 500 && res.status !== 429) {
                const err = new Error(`HTTP ${res.status} for ${url}`)
                err.status = res.status
                throw err
            }
            if (attempt > retries) throw new Error(`HTTP ${res.status} for ${url} (after ${retries} retries)`)
        } catch (err) {
            if (err.status || attempt > retries) throw err
        }
        await sleep(2000 * attempt)
    }
}

export async function getText(url) {
    return (await request(url)).text()
}

export async function getJson(url) {
    return (await request(url)).json()
}

export async function getBuffer(url) {
    return Buffer.from(await (await request(url)).arrayBuffer())
}

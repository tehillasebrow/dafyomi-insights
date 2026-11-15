// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// A healthy query answers in well under a second. When Supabase is struggling
// its requests hang for ~20s before failing (Cloudflare 522), and Vercel bills
// every second a page spends waiting, so give up after a few seconds instead.
const DB_TIMEOUT_MS = 8000

function fetchWithTimeout(input, init = {}) {
    const timeout = AbortSignal.timeout(DB_TIMEOUT_MS)
    const signal = !init.signal ? timeout
        : typeof AbortSignal.any === 'function' ? AbortSignal.any([init.signal, timeout])
        : init.signal
    return fetch(input, { ...init, signal })
}

// Thrown on the server when the database is down or too slow (no answer, or a
// 5xx). Without it a failed query looks like "no rows": the page would show a
// 404 or an empty list, and that broken page would then be cached. Throwing
// shows the "This page didn't load" screen instead, which is never cached,
// and a page that was already cached keeps serving its last good copy.
// Ordinary query errors (4xx) are still returned as { error } as before.
export class DatabaseUnavailableError extends Error {
    constructor(error, status) {
        super(`Database unavailable (status ${status}): ${error?.message ?? 'no response'}`)
        this.name = 'DatabaseUnavailableError'
    }
}

const isOutage = (res) => Boolean(res?.error) && (res.status === 0 || res.status >= 500)

function throwOnOutage(builder) {
    if (!builder || typeof builder.then !== 'function') return builder
    const then = builder.then.bind(builder)
    builder.then = (onFulfilled, onRejected) => then((res) => {
        if (isOutage(res)) {
            console.error(`Supabase outage: status ${res.status}: ${res.error.message}`)
            throw new DatabaseUnavailableError(res.error, res.status)
        }
        return res
    }).then(onFulfilled, onRejected)
    return builder
}

const QUERY_METHODS = ['select', 'insert', 'upsert', 'update', 'delete']

const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchWithTimeout },
})

// Browsers keep the old behaviour (search box, comments handle { error } themselves).
if (typeof window === 'undefined') {
    const from = client.from.bind(client)
    client.from = (relation) => {
        const query = from(relation)
        for (const method of QUERY_METHODS) {
            const original = query[method].bind(query)
            query[method] = (...args) => throwOnOutage(original(...args))
        }
        return query
    }
    const rpc = client.rpc.bind(client)
    client.rpc = (...args) => throwOnOutage(rpc(...args))
}

export const supabase = client

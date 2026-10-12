// lib/events.js
// Writes to the site_events table (visitor analytics + audit log).
// Logging never throws: a failed log must not break the action being logged.
import 'server-only'
import { cookies, headers } from 'next/headers'
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin'
import { isAdmin } from '@/app/lib/adminAuth'

export const VISITOR_COOKIE = 'vid'
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|python-requests/i

const clip = (value, max) => (value == null || value === '' ? null : String(value).slice(0, max))

function decode(value) {
    if (!value) return null
    try { return decodeURIComponent(value) } catch { return value }
}

export async function isBot() {
    const h = await headers()
    return BOT_RE.test(h.get('user-agent') || '')
}

// Returns the visitor id, creating the cookie if `create` is set
// (cookies can only be set from server actions / route handlers).
export async function getVisitorId({ create = false } = {}) {
    const store = await cookies()
    let id = store.get(VISITOR_COOKIE)?.value
    if (!id && create) {
        id = crypto.randomUUID()
        store.set(VISITOR_COOKIE, id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
        })
    }
    return id || null
}

export async function logEvent(type, { path, query, referrer, details, createVisitor = false } = {}) {
    try {
        const h = await headers()
        const event = {
            type,
            visitor_id: await getVisitorId({ create: createVisitor }),
            is_admin: await isAdmin().catch(() => false),
            path: clip(path ?? h.get('referer')?.replace(/^https?:\/\/[^/]+/, ''), 500),
            query: clip(query, 200),
            referrer: clip(referrer, 500),
            ip: clip(h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip'), 64),
            country: clip(h.get('x-vercel-ip-country'), 8),
            region: clip(h.get('x-vercel-ip-country-region'), 16),
            city: clip(decode(h.get('x-vercel-ip-city')), 100),
            user_agent: clip(h.get('user-agent'), 400),
            details: details ?? null,
        }
        const { error } = await getSupabaseAdmin().from('site_events').insert([event])
        if (error) console.error('logEvent failed:', error.message)
    } catch (err) {
        console.error('logEvent failed:', err)
    }
}

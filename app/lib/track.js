'use server'
// Public tracking actions called from the browser (Analytics + Search components).

import { logEvent, isBot } from '@/app/lib/events'

const isPath = (p) => typeof p === 'string' && p.startsWith('/')

export async function trackPageView({ path, referrer } = {}) {
    if (!isPath(path) || path.startsWith('/admin') || (await isBot())) return
    await logEvent('page_view', {
        path,
        referrer: typeof referrer === 'string' && /^https?:\/\//.test(referrer) ? referrer : null,
        createVisitor: true,
    })
}

export async function trackSearch({ query, results, path } = {}) {
    if (typeof query !== 'string' || query.trim().length < 2 || (await isBot())) return
    await logEvent('search', {
        path: isPath(path) ? path : undefined,
        query: query.trim(),
        details: { results: Number(results) || 0 },
        createVisitor: true,
    })
}

export async function trackSearchClick({ query, target } = {}) {
    if (!isPath(target) || (await isBot())) return
    await logEvent('search_click', {
        path: target,
        query: typeof query === 'string' ? query.trim() : null,
        createVisitor: true,
    })
}

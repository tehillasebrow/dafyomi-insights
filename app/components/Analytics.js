'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackPageView } from '@/app/lib/track'

// Logs a page_view on first load and on every client-side navigation.
export default function Analytics() {
    const pathname = usePathname()
    const lastPath = useRef(null)

    useEffect(() => {
        const path = pathname + window.location.search
        if (path === lastPath.current) return // guards React strict-mode double effects
        const isFirst = lastPath.current === null
        lastPath.current = path

        // Only the first page of a visit has a meaningful external referrer
        let referrer = null
        if (isFirst && document.referrer) {
            try {
                if (new URL(document.referrer).host !== window.location.host) referrer = document.referrer
            } catch {}
        }
        trackPageView({ path, referrer }).catch(() => {})
    }, [pathname])

    return null
}

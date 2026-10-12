'use client'

import { useState, useSyncExternalStore } from 'react'

const noSubscription = () => () => {}

// Share at the foot of an article. Phones that can share natively get a "Share" button;
// WhatsApp, email, copy and print are always there.
export default function ShareButtons({ url, title, compact = false }) {
    // false on the server and during hydration, then the browser's real answer
    const canShare = useSyncExternalStore(noSubscription, () => typeof navigator.share === 'function', () => false)
    const [status, setStatus] = useState('')

    async function nativeShare() {
        try { await navigator.share({ title, url }) } catch {}
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(url)
            setStatus('Link copied')
        } catch {
            setStatus('Couldn’t copy. Press and hold the address bar to copy the link.')
        }
        setTimeout(() => setStatus(''), 4000)
    }

    const text = encodeURIComponent(`${title} ${url}`)

    if (compact) {
        return canShare ? <button type="button" className="btn-quiet" onClick={nativeShare}>Share</button> : null
    }

    return (
        <div className="flex flex-wrap items-center gap-2" data-no-print>
            <span className="sc">Share</span>
            {canShare && <button type="button" className="btn-quiet" onClick={nativeShare}>Share…</button>}
            <a className="btn-quiet" href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a className="btn-quiet" href={`mailto:?subject=${encodeURIComponent(title)}&body=${text}`}>Email</a>
            <button type="button" className="btn-quiet" onClick={copy}>Copy link</button>
            <button type="button" className="btn-quiet" onClick={() => window.print()}>Print</button>
            <span className="meta" role="status" aria-live="polite">{status}</span>
        </div>
    )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SubscribeForm, { SUBSCRIBED_KEY } from './SubscribeForm'

const DISMISSED_KEY = 'newsletter-popup-dismissed'
const DELAY_MS = 15000
const HIDE_FOR_DAYS = 30
const HIDDEN_ON = ['/admin', '/unsubscribe']

function shouldOffer() {
    try {
        if (localStorage.getItem(SUBSCRIBED_KEY)) return false
        const dismissed = Number(localStorage.getItem(DISMISSED_KEY))
        return !dismissed || Date.now() - dismissed > HIDE_FOR_DAYS * 86400000
    } catch {
        // Storage blocked: don't nag on every page
        return false
    }
}

// A small sign-up card, bottom corner on desktop and a bottom sheet on phones.
// Shows once, 15 seconds in or halfway down the page, and stays away for 30 days
// after it's closed (for good once they sign up). It never blocks the page.
export default function SubscribePopup() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const [done, setDone] = useState(false)
    const hiddenHere = HIDDEN_ON.some(p => pathname === p || pathname.startsWith(`${p}/`))

    useEffect(() => {
        if (hiddenHere || !shouldOffer()) return
        const show = () => {
            if (shouldOffer()) setOpen(true)
            cleanup()
        }
        const onScroll = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight
            if (max > 0 && window.scrollY / max >= 0.5) show()
        }
        const timer = setTimeout(show, DELAY_MS)
        window.addEventListener('scroll', onScroll, { passive: true })
        function cleanup() {
            clearTimeout(timer)
            window.removeEventListener('scroll', onScroll)
        }
        return cleanup
    }, [hiddenHere])

    const close = useCallback(() => {
        setOpen(false)
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch {}
    }, [])

    useEffect(() => {
        if (!open) return
        const onKey = e => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, close])

    // Close a moment after a successful sign-up so they see the confirmation
    const onSubscribed = useCallback(() => {
        setDone(true)
        setTimeout(() => setOpen(false), 4000)
    }, [])

    if (!open || hiddenHere) return null

    return (
        <aside
            role="dialog"
            aria-labelledby="subscribe-popup-title"
            className="fixed z-40 inset-x-0 bottom-0 md:inset-x-auto md:right-6 md:bottom-6 md:w-[24rem] bg-paper text-ink border-t-[3px] border-double border-rule-hard md:border md:border-rule-hard shadow-[0_-4px_24px_rgb(0_0_0/0.18)] md:shadow-[0_8px_32px_rgb(0_0_0/0.22)]"
        >
            <div className="grid gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                        <span className="sc">Weekly</span>
                        <h2 id="subscribe-popup-title" className="text-[1.25rem] font-semibold leading-snug">Get each new article by email</h2>
                    </div>
                    <button type="button" onClick={close} className="btn-quiet shrink-0 -mr-1 -mt-1" aria-label="Close">✕</button>
                </div>
                {!done && <p className="note">Rabbi Sebrow’s new “Delving into the Daf” column, in your inbox the week it comes out. Unsubscribe anytime.</p>}
                <SubscribeForm source="popup" onSubscribed={onSubscribed} />
            </div>
        </aside>
    )
}

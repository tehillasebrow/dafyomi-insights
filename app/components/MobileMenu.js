'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV, isCurrent } from './NavLinks'
import DafPicker from './DafPicker'
import ThemeToggle from './ThemeToggle'
import { LogoMark } from './Logo'
import { dafYomiFor, todayInNewYork, hebrewNumeral, dayLabel } from '@/app/lib/shas'

const LINKS = [
    NAV[0],
    { href: '/stories', label: 'Gemara stories', match: ['/stories'] },
    { href: '/people', label: 'Stories by sage', match: ['/people'] },
    NAV[2],
    NAV[3],
    { href: '/daily/archive', label: 'Past discussions', match: ['/daily/archive'] },
    { href: '/contact', label: 'About and contact', match: ['/contact'] },
]

// Full-height menu for phones. Today's daf is worked out when the menu opens,
// so a cached page never shows yesterday's daf.
export default function MobileMenu() {
    // The menu remembers the page it was opened on, so navigating anywhere closes it
    const pathname = usePathname() ?? '/'
    const [openOn, setOpenOn] = useState(null)
    const open = openOn === pathname
    const setOpen = value => setOpenOn(value ? pathname : null)
    const buttonRef = useRef(null)
    const closeRef = useRef(null)

    useEffect(() => {
        if (!open) return
        closeRef.current?.focus()
        document.body.style.overflow = 'hidden'
        const onKey = e => { if (e.key === 'Escape') setOpenOn(null) }
        window.addEventListener('keydown', onKey)
        const button = buttonRef.current
        return () => {
            document.body.style.overflow = ''
            window.removeEventListener('keydown', onKey)
            button?.focus()
        }
    }, [open])

    const today = open ? todayInNewYork() : null
    const daf = today ? dafYomiFor(today) : null
    const label = today ? dayLabel(today) : null

    return (
        <>
            <button ref={buttonRef} type="button" className="btn-quiet lg:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden sm:block w-[18px] h-[18px] fill-none stroke-current stroke-[1.7]"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
                Menu
            </button>
            {open && createPortal(
                <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 bg-paper text-ink overflow-y-auto lg:hidden">
                    <div className="folio pb-8">
                        <div className="flex items-center justify-between py-2.5 border-b-[3px] border-double border-rule">
                            <span className="flex items-center gap-2.5"><LogoMark className="w-9 h-9" /><span className="font-semibold text-[1.25rem] tracking-[-0.02em]">Daf Yomi Insights</span></span>
                            <button ref={closeRef} type="button" className="btn-quiet" onClick={() => setOpen(false)}>Close</button>
                        </div>
                        <div className="grid gap-4 py-4 border-b border-rule-hard">
                            <Link href="/daily" className="on-binding plain grid grid-cols-[auto_1fr] gap-x-3.5 items-center p-4">
                                <span lang="he" className="numeral text-[3.25rem] text-foil row-span-3">{hebrewNumeral(daf.daf)}</span>
                                <span className="sc">Today{label ? ` · ${label.name}` : ''}</span>
                                <b className="text-[1.375rem] leading-tight">{daf.masechta.name} {daf.daf}</b>
                                <span className="meta underline">Discussion and this week’s article</span>
                            </Link>
                            <DafPicker id="menu-picker" initialMasechta={daf.masechta.name} initialDaf={daf.daf} onGo={() => setOpen(false)} />
                        </div>
                        <nav aria-label="Main">
                            {LINKS.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={isCurrent(pathname, item) ? 'page' : undefined}
                                    className="plain flex items-center min-h-14 text-[1.3rem] border-b border-rule aria-[current=page]:font-semibold"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="pt-5"><ThemeToggle /></div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}

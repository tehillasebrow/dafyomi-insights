'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Main menu, in the owner's order. Stories and the smaller pages live under "More".
export const NAV = [
    { href: '/articles', label: 'Articles', match: ['/articles', '/daf/'] },
    { href: '/beyond-the-daf', label: 'Beyond the Daf', match: ['/beyond-the-daf'] },
    { href: '/masechtos', label: 'Masechtos', match: ['/masechtos'] },
    { href: '/topics', label: 'Topics', match: ['/topics'] },
    { href: '/daily', label: "Today's Daf", match: ['/daily'] },
    { href: '/contact', label: 'About', match: ['/contact'] },
]

export const MORE = [
    { href: '/stories', label: 'Gemara stories', match: ['/stories'] },
    { href: '/people', label: 'Stories by sage', match: ['/people'] },
    { href: '/daily/archive', label: 'Past discussions', match: ['/daily/archive'] },
]

export function isCurrent(pathname, item) {
    return item.match.some(m => pathname === m || pathname.startsWith(m.endsWith('/') ? m : `${m}/`))
}

export default function NavLinks() {
    const pathname = usePathname() ?? '/'
    // The More menu remembers the page it was opened on, so navigating anywhere closes it
    const [openOn, setOpenOn] = useState(null)
    const open = openOn === pathname
    const wrap = useRef(null)

    useEffect(() => {
        if (!open) return
        const onKey = e => { if (e.key === 'Escape') setOpenOn(null) }
        const onClick = e => { if (!wrap.current?.contains(e.target)) setOpenOn(null) }
        window.addEventListener('keydown', onKey)
        document.addEventListener('pointerdown', onClick)
        return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onClick) }
    }, [open])

    const more = MORE
    const moreCurrent = more.some(item => isCurrent(pathname, item))

    return (
        <nav aria-label="Main" className="hidden lg:flex items-center gap-x-1">
            {NAV.map(item => (
                <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent(pathname, item) ? 'page' : undefined}
                    className="nav-a"
                >
                    {item.label}
                </Link>
            ))}
            <div ref={wrap} className="relative">
                <button
                    type="button"
                    className="nav-a"
                    aria-expanded={open}
                    aria-controls="more-menu"
                    data-current={moreCurrent || undefined}
                    onClick={() => setOpenOn(open ? null : pathname)}
                >
                    More
                    <svg aria-hidden="true" viewBox="0 0 12 12" className={`w-3 h-3 ml-1 fill-none stroke-current stroke-[1.8] transition-transform ${open ? 'rotate-180' : ''}`}><path d="M2 4l4 4 4-4" /></svg>
                </button>
                {open && (
                    <ul id="more-menu" className="absolute right-0 top-full z-40 mt-1 min-w-[14rem] index-card py-1">
                        {more.map(item => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    aria-current={isCurrent(pathname, item) ? 'page' : undefined}
                                    className="flex items-center min-h-11 px-4 no-underline hover:bg-mark aria-[current=page]:font-bold"
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </nav>
    )
}

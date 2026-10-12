'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV = [
    { href: '/articles', label: 'Articles', match: ['/articles', '/daf/'] },
    { href: '/stories', label: 'Stories', match: ['/stories', '/people'] },
    { href: '/masechtos', label: 'Masechtos', match: ['/masechtos'] },
    { href: '/topics', label: 'Topics', match: ['/topics'] },
    { href: '/daily', label: "Today's Daf", match: ['/daily'] },
    { href: '/contact', label: 'About', match: ['/contact'] },
]

export function isCurrent(pathname, item) {
    return item.match.some(m => pathname === m || pathname.startsWith(m.endsWith('/') ? m : `${m}/`))
}

export default function NavLinks() {
    const pathname = usePathname() ?? '/'
    return (
        <nav aria-label="Main" className="hidden lg:flex items-center gap-x-5 text-[1.03rem]">
            {NAV.map(item => {
                const current = isCurrent(pathname, item)
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        className={`min-h-11 inline-flex items-center no-underline hover:underline ${current ? 'underline decoration-2 decoration-foil underline-offset-8' : ''}`}
                    >
                        {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}

import Link from 'next/link'

// A daf in miniature: the Gemara block held by Rashi and Tosafos on either side.
// The parts carry classes so the home page can assemble it once on load.
export function LogoMark({ className = 'w-9 h-9' }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
            <rect width="32" height="32" fill="#1c1e23" />
            <path className="logo-r" d="M5 5h9v3H8v19H5z" fill="#c8a24a" />
            <path className="logo-t" d="M27 5h-9v3h6v19h3z" fill="#c8a24a" />
            <g className="logo-g" fill="#c8a24a">
                <rect x="10" y="10" width="12" height="12" />
                <rect x="10" y="24" width="12" height="3" />
            </g>
        </svg>
    )
}

export default function Logo() {
    return (
        <Link href="/" className="plain flex items-center gap-2.5 min-h-11 shrink-0" aria-label="Daf Yomi Insights, home">
            <LogoMark className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
            <span className="leading-none">
                <span className="block text-[1.06rem] sm:text-[1.25rem] font-semibold tracking-[-0.02em]">Daf Yomi Insights</span>
                <span className="block mt-1 text-small text-binding-soft">Rabbi Avrohom Sebrow</span>
            </span>
        </Link>
    )
}

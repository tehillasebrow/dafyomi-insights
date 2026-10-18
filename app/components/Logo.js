import Link from 'next/link'

// A daf in miniature: the Gemara block held by Rashi and Tosafos on either side.
// The parts carry classes so the home page can assemble it once on load.
export function LogoMark({ className = 'w-9 h-9' }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
            <rect width="32" height="32" fill="#17181c" />
            <path className="logo-r" d="M5 5h9v3H8v19H5z" fill="#ffe53b" />
            <path className="logo-t" d="M27 5h-9v3h6v19h3z" fill="#ffe53b" />
            <g className="logo-g" fill="#ffe53b">
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
                <span className="block font-display text-[1.02rem] sm:text-[1.3rem] tracking-[-0.01em]">Daf Yomi Insights</span>
                <span className="block mt-1 text-small text-ink-soft">Rabbi Avrohom Sebrow</span>
            </span>
        </Link>
    )
}

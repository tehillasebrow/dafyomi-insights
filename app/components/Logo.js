import Link from 'next/link'

// A daf in miniature: the Gemara block held by Rashi and Tosafos on either side.
// The parts carry classes so the home page can assemble it once on load.
// onBlack swaps the colours so the mark shows on the black menu bar.
export function LogoMark({ className = 'w-9 h-9', onBlack = false }) {
    const [ground, ink] = onBlack ? ['#ffe53b', '#17181c'] : ['#17181c', '#ffe53b']
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
            <rect width="32" height="32" fill={ground} />
            <path className="logo-r" d="M5 5h9v3H8v19H5z" fill={ink} />
            <path className="logo-t" d="M27 5h-9v3h6v19h3z" fill={ink} />
            <g className="logo-g" fill={ink}>
                <rect x="10" y="10" width="12" height="12" />
                <rect x="10" y="24" width="12" height="3" />
            </g>
        </svg>
    )
}

export default function Logo({ onBlack = false }) {
    return (
        <Link href="/" className="plain flex items-center gap-2.5 min-h-11 shrink-0" aria-label="Daf Yomi Insights, home">
            <LogoMark onBlack={onBlack} className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
            <span className="leading-none">
                <span className="block font-display text-[1.02rem] sm:text-[1.3rem] tracking-[-0.01em]">Daf Yomi Insights</span>
                <span className={`block mt-1 text-small ${onBlack ? "text-binding-soft" : "text-ink-soft"}`}>Rabbi Avrohom Sebrow</span>
            </span>
        </Link>
    )
}

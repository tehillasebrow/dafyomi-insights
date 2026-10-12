import Link from 'next/link'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const TITLES = /^(rabbi|rabban|rav|r'|rebbi|reb)\s+/i

// Set like the index at the back of a sefer: a letter bar, then entries with dotted
// leaders to their counts. entries: [{ label, href, note }]. With `ignoreTitles`,
// "Rabbi Akiva" is filed under A.
export default function AlphaIndex({ entries, ignoreTitles = false, idPrefix = 'letter' }) {
    const key = e => (ignoreTitles ? e.label.replace(TITLES, '') : e.label).trim()
    const sorted = [...entries].sort((a, b) => key(a).localeCompare(key(b)))
    const groups = new Map()
    for (const e of sorted) {
        const first = key(e)[0]?.toUpperCase()
        const letter = LETTERS.includes(first) ? first : '#'
        if (!groups.has(letter)) groups.set(letter, [])
        groups.get(letter).push(e)
    }

    return (
        <>
            <nav aria-label="Jump to letter" className="flex flex-wrap gap-0.5 py-2.5 border-b border-rule">
                {LETTERS.map(l => groups.has(l)
                    ? <a key={l} href={`#${idPrefix}-${l}`} className="min-w-11 min-h-11 grid place-items-center text-[1.06rem]">{l}</a>
                    : <span key={l} aria-disabled="true" className="min-w-11 min-h-11 grid place-items-center text-[1.06rem] text-ink-faint">{l}</span>)}
            </nav>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-9 pt-1.5">
                {[...groups].map(([letter, items]) => (
                    <section key={letter} id={`${idPrefix}-${letter}`} aria-label={letter} className="break-inside-avoid-column scroll-mt-4">
                        <h2 className="font-semibold text-[1.9rem] text-foil-ink pt-3 break-after-avoid">{letter}</h2>
                        <ul>
                            {items.map(e => (
                                <li key={e.href} className="break-inside-avoid">
                                    <Link href={e.href} className="plain flex items-baseline gap-2 min-h-11 py-2 text-[1.09rem] hover:underline">
                                        <span>{e.label}</span>
                                        <i className="flex-1 border-b border-dotted border-ink-soft -translate-y-1" aria-hidden="true" />
                                        <span className="meta whitespace-nowrap">{e.note}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </>
    )
}

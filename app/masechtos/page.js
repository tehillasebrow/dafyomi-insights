import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { MASECHTOS, SEDARIM, findMasechta, masechtaHref, todayInNewYork, dafYomiFor, siyumDate, dateOfDaf, formatDate, CYCLE_LENGTH } from '@/app/lib/shas'
import { buildMetadata } from '@/app/lib/seo'

export const revalidate = 3600

export const metadata = buildMetadata({
    title: 'All Masechtos of Shas – Daf Yomi Articles by Masechta',
    description: 'Daf Yomi articles and Gemara stories on every masechta of the Daf Yomi cycle, arranged by seder.',
    path: '/masechtos',
})

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
// Dates outside the current year carry the year, so a siyum from 2020 isn't read as this spring
const dateFor = (d, today) => ({ month: 'short', day: 'numeric', ...(d.getUTCFullYear() !== today.getUTCFullYear() && { year: 'numeric' }) })

export default async function MasechtosPage() {
    const [{ data: articles }, { data: stories }] = await Promise.all([
        supabase.from('articles').select('masechta'),
        supabase.from('stories').select('masechta'),
    ])
    const tally = rows => {
        const m = new Map()
        for (const r of rows ?? []) {
            const name = findMasechta(r.masechta)?.name
            if (name) m.set(name, (m.get(name) ?? 0) + 1)
        }
        return m
    }
    const articleCounts = tally(articles)
    const storyCounts = tally(stories)

    // Hourly cache: the "learning now" tile can lag by up to an hour after midnight.
    const today = todayInNewYork()
    const todays = dafYomiFor(today)
    const current = todays.masechta
    const next = MASECHTOS[(MASECHTOS.indexOf(current) + 1) % MASECHTOS.length]

    const counts = name => {
        const a = articleCounts.get(name) ?? 0, s = storyCounts.get(name) ?? 0
        if (!a && !s) return 'No articles yet'
        return [a && plural(a, 'article', 'articles'), s && plural(s, 'story', 'stories')].filter(Boolean).join(' · ')
    }

    return (
        <div className="folio py-6 md:py-8">
            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Masechtos</h1>
                <p className="text-lede text-ink-soft max-w-[62ch]">
                    The Daf Yomi cycle: Talmud Bavli, with Shekalim from the Yerushalmi and the Mishnayos of Kinnim and Middos.
                    Today is daf {todays.position.toLocaleString('en-US')} of {CYCLE_LENGTH.toLocaleString('en-US')}.
                </p>
            </header>

            <Link href={masechtaHref(current.name)} className="on-binding plain grid gap-1 p-4 mt-5 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-x-6">
                <span lang="he" className="numeral text-[3.25rem] text-foil">{current.hebrew}</span>
                <span>
                    <b className="font-semibold text-[1.375rem]">Learning now: {current.name} {todays.daf}</b><br />
                    <span className="meta">Siyum {formatDate(siyumDate(current, today), { weekday: 'long', month: 'long', day: 'numeric' })} · {next.name} begins {formatDate(new Date(siyumDate(current, today).getTime() + 86400000), { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </span>
                <span className="meta">{counts(current.name)}</span>
            </Link>

            <nav aria-label="Jump to seder" className="flex flex-wrap gap-1.5 py-3.5 border-b border-rule">
                {SEDARIM.map(s => <a key={s.name} href={`#${s.name.toLowerCase()}`} className="chip">{s.name}</a>)}
            </nav>

            {SEDARIM.map(seder => (
                <section key={seder.name} id={seder.name.toLowerCase()} aria-labelledby={`${seder.name}-h`} className="pt-6 scroll-mt-4">
                    <h2 id={`${seder.name}-h`} className="flex items-baseline gap-2.5 font-semibold text-[1.375rem] pb-2.5">
                        <span lang="he" className="font-medium text-[1.6rem]">סדר {seder.hebrew}</span> Seder {seder.name}
                    </h2>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] border-t border-l border-rule">
                        {MASECHTOS.filter(m => m.seder === seder.name).map(m => {
                            const isNow = m === current
                            const siyum = siyumDate(m, today)
                            const begins = dateOfDaf(m.name, m.first, today)
                            const has = articleCounts.get(m.name) || storyCounts.get(m.name)
                            const when = isNow ? 'Learning now'
                                : siyum < today ? `Siyum ${formatDate(siyum, dateFor(siyum, today))}`
                                : `Begins ${formatDate(begins, dateFor(begins, today))}`
                            return (
                                <li key={m.name} className="border-r border-b border-rule">
                                    <Link href={masechtaHref(m.name)} className={`plain grid gap-px p-3 h-full hover:bg-paper-sunk ${isNow ? 'on-binding hover:bg-binding' : ''}`}>
                                        <span lang="he" className="text-[1.6rem] leading-tight">{m.hebrew}</span>
                                        <b className={`text-[1.12rem] ${has ? 'font-semibold' : 'font-normal'}`}>{m.name}</b>
                                        <span className="meta text-small">{counts(m.name)}</span>
                                        <span className="meta text-small">{when}{m.first !== 2 ? ` · dafim ${m.first}–${m.last}` : ''}</span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            ))}
        </div>
    )
}

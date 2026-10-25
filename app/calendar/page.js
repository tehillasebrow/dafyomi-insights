import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { buildMetadata, breadcrumbJsonLd } from '@/app/lib/seo'
import { todayInNewYork, dafYomiFor, siyumDate, siyumHaShasDate, hebrewNumeral, MASECHTOS } from '@/app/lib/shas'
import JsonLd from '@/app/components/JsonLd'
import DafCalendar from '@/app/components/DafCalendar'

// Rebuilt every hour so "today" and the week cards move with the calendar
export const revalidate = 3600

const fmt = (d, o = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) => d.toLocaleDateString('en-US', { timeZone: 'UTC', ...o })

export async function generateMetadata() {
    const today = todayInNewYork()
    const year = today.getUTCFullYear()
    return buildMetadata({
        title: `Daf Yomi Calendar ${year}–${year + 1}: Every Daf by Date`,
        description: `The Daf Yomi schedule week by week: today's daf, which daf falls on each date, the coming siyumim and the Siyum HaShas. Print as many weeks as you need.`,
        path: '/calendar',
        keywords: ['Daf Yomi calendar', 'Daf Yomi schedule', `Daf Yomi calendar ${year}`, 'Daf Yomi luach', 'Siyum HaShas date'],
    })
}

export default async function CalendarPage() {
    const today = todayInNewYork()
    const now = dafYomiFor(today)
    // Dafim that have an article, so their days link to it
    const { data } = await supabase.from('articles').select('masechta, daf, daf_end').not('masechta', 'is', null)
    const covered = new Set()
    for (const a of data ?? []) for (let d = a.daf; d <= (a.daf_end ?? a.daf); d++) covered.add(`${a.masechta}|${d}`)

    // The next six siyumim, from today's masechta on (wrapping into the next cycle)
    const i = MASECHTOS.indexOf(now.masechta)
    const coming = Array.from({ length: 6 }, (_, k) => MASECHTOS[(i + k) % MASECHTOS.length])
        .map(m => ({ m, date: siyumDate(m, today) }))
        .map(s => (s.date < today ? { ...s, date: siyumDate(s.m, new Date(today.getTime() + 2711 * 86400000)) } : s))
    const shas = siyumHaShasDate(today)
    const daysToShas = Math.round((shas - today) / 86400000)

    return (
        <div className="folio py-6 md:py-8 grid gap-8">
            <JsonLd data={breadcrumbJsonLd([{ name: 'Daf Yomi Calendar', path: '/calendar' }])} />
            <header className="grid gap-2">
                <h1 className="text-[clamp(2.1rem,5vw,3.25rem)] leading-[1.05]"><span className="hl">Daf Yomi Calendar</span></h1>
            </header>

            <section aria-label="Today's daf" className="bg-foil text-[#17181c] rounded-md px-5 py-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1 items-center max-sm:grid-cols-1">
                <span lang="he" className="sticker sticker-tilt font-display text-[3rem] leading-none row-span-3 max-sm:row-span-1 justify-self-start">{hebrewNumeral(now.daf)}</span>
                <p className="text-sm font-semibold">{fmt(today)}</p>
                <h2 className="text-[1.7rem]">Today: <Link href={`/daily`} className="plain">{now.masechta.name} {now.daf}</Link></h2>
                <p className="text-[#3d4048]">
                    <b className="text-[#17181c]">{now.masechta.last - now.daf} dafim</b> to the siyum on {now.masechta.name}
                    {' · '}<b className="text-[#17181c]">{daysToShas.toLocaleString()} days</b> to the Siyum HaShas ({fmt(shas, { month: 'long', day: 'numeric', year: 'numeric' })})
                </p>
            </section>

            <DafCalendar todayIso={today.toISOString()} covered={[...covered]} />

            <section aria-labelledby="siyumim-h" className="grid gap-3 break-inside-avoid">
                <h2 id="siyumim-h" className="text-h2"><span className="hl">Coming siyumim</span></h2>
                <ul className="grid gap-2.5 list-none p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {coming.map(({ m, date }) => (
                        <li key={m.name} className="index-card px-3.5 py-2.5 grid">
                            <span className="font-display text-[1.1rem]">{m.name} <span lang="he" className="text-ink-faint text-[0.95rem]">{m.hebrew}</span></span>
                            <span className="text-ui text-ink-soft">{fmt(date)}</span>
                        </li>
                    ))}
                </ul>
                <p className="text-ui text-ink-soft">The Siyum HaShas of this cycle is on {fmt(shas)}. The next cycle begins with Berachos 2 the following day, and this calendar carries on into it by itself.</p>
            </section>
        </div>
    )
}

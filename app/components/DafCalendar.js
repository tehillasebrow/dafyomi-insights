'use client'
// The Daf Yomi calendar, week by week: one index card per week, today in yellow,
// a heavy line where a new masechta starts. The reader picks how many weeks to show
// (and print), and can look up the date of any daf.
import { useState } from 'react'
import Link from 'next/link'
import { dafYomiFor, dateOfDaf, hebrewNumeral, hebrewDate, findMasechta } from '@/app/lib/shas'
import { dafPath } from '@/app/lib/articles'

const DAY = 86400000
const CHOICES = [4, 8, 13, 26, 52]
const fmt = (d, o) => d.toLocaleDateString('en-US', { timeZone: 'UTC', ...o })

export default function DafCalendar({ todayIso, covered = [] }) {
    const today = new Date(todayIso)
    const hasArticle = new Set(covered)
    const [weeks, setWeeks] = useState(8)
    const [query, setQuery] = useState('')

    const sunday = new Date(today.getTime() - today.getUTCDay() * DAY)
    const cards = Array.from({ length: weeks }, (_, w) => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(sunday.getTime() + (w * 7 + i) * DAY)
            return { date, ...dafYomiFor(date) }
        })
        return { start: days[0], end: days[6], days }
    })

    return (
        <div className="grid gap-5">
            <div data-no-print className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <label className="grid gap-1 text-ui">
                    <span className="meta">Weeks to show and print</span>
                    <select id="cal-weeks" value={weeks} onChange={e => setWeeks(Number(e.target.value))} className="border border-rule rounded px-2.5 py-2 bg-surface text-ink">
                        {CHOICES.map(n => <option key={n} value={n}>{n} weeks{n === 13 ? ' (3 months)' : n === 26 ? ' (6 months)' : n === 52 ? ' (a year)' : ''}</option>)}
                    </select>
                </label>
                <button type="button" onClick={() => window.print()} className="btn">Print this calendar</button>
                <FindDaf query={query} setQuery={setQuery} today={today} />
            </div>

            <p className="hidden print:block text-sm">Daf Yomi calendar, {fmt(cards[0].start.date, { month: 'long', day: 'numeric', year: 'numeric' })} to {fmt(cards.at(-1).end.date, { month: 'long', day: 'numeric', year: 'numeric' })} · dafyomiinsights.com</p>

            <ol className="grid gap-3 list-none p-0">
                {cards.map(({ start, end, days }, w) => (
                    <li key={start.date.toISOString()} className={`index-card px-3.5 py-3 grid gap-2 break-inside-avoid ${w === 0 ? 'ring-2 ring-foil' : ''}`}>
                        <p className="meta flex flex-wrap justify-between gap-x-3">
                            <span>
                                <b className="text-ink">{w === 0 ? 'This week' : w === 1 ? 'Next week' : `Week of ${fmt(start.date, { month: 'short', day: 'numeric' })}`}</b>
                                {' · '}{start.masechta.name} {start.daf}{start.masechta === end.masechta ? `–${end.daf}` : ` – ${end.masechta.name} ${end.daf}`}
                            </span>
                            <span>{fmt(start.date, { month: 'short', day: 'numeric' })} – {fmt(end.date, { month: 'short', day: 'numeric', year: 'numeric' })} · <span lang="he">{hebrewDate(start.date, { year: false })}</span></span>
                        </p>
                        <ul className="grid grid-cols-7 gap-1.5 list-none p-0">
                            {days.map(d => {
                                const isToday = d.date.getTime() === today.getTime()
                                const startsMasechta = d.daf === d.masechta.first
                                const article = hasArticle.has(`${d.masechta.name}|${d.daf}`)
                                const label = `${fmt(d.date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${d.masechta.name} ${d.daf}${article ? ', with an article' : ''}`
                                const body = (
                                    <>
                                        <span className="text-[0.72rem] text-ink-faint">{fmt(d.date, { weekday: 'short' })} {fmt(d.date, { day: 'numeric' })}</span>
                                        <span lang="he" className="font-display text-[1.3rem] leading-tight text-foil-ink">{hebrewNumeral(d.daf)}</span>
                                        <span className="text-[0.78rem] text-ink-soft truncate max-sm:hidden">{startsMasechta ? <b className="text-ink">{d.masechta.name}</b> : `${d.masechta.name} ${d.daf}`}</span>
                                        {article && <span className="text-[0.68rem] text-ink-soft max-sm:hidden" aria-hidden="true">● article</span>}
                                    </>
                                )
                                const cls = `grid gap-px text-center rounded px-1 py-1.5 min-w-0 ${isToday ? 'bg-foil text-[#17181c]' : ''} ${startsMasechta ? 'shadow-[inset_3px_0_0_var(--ink)]' : ''}`
                                return (
                                    <li key={d.date.toISOString()} className="min-w-0">
                                        {article
                                            ? <Link href={dafPath(d.masechta.name, d.daf)} aria-label={label} className={`${cls} plain hover:bg-paper-sunk`}>{body}</Link>
                                            : <span aria-label={label} className={cls}>{body}</span>}
                                    </li>
                                )
                            })}
                        </ul>
                    </li>
                ))}
            </ol>
        </div>
    )
}

// "Arachin 10" -> the date it's learned
function FindDaf({ query, setQuery, today }) {
    const m = query.trim().match(/^(.+?)\s*(\d{1,3})$/)
    const masechta = m && findMasechta(m[1])
    const daf = m && Number(m[2])
    let answer = ''
    if (query.trim()) {
        if (!masechta || daf < masechta.first || daf > masechta.last) answer = 'Type a masechta and daf, like “Arachin 10”.'
        else {
            let date = dateOfDaf(masechta.name, daf, today)
            if (date < today) date = dateOfDaf(masechta.name, daf, new Date(today.getTime() + 2711 * DAY))
            answer = `${masechta.name} ${daf} is learned on ${fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`
        }
    }
    return (
        <div className="grid gap-1 min-w-0">
            <label htmlFor="cal-find" className="meta">Find the date of a daf</label>
            <input id="cal-find" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Arachin 10" className="border border-rule rounded px-2.5 py-2 bg-surface text-ink w-60 max-w-full" />
            <p className="text-ui text-ink-soft min-h-[1.5em]" aria-live="polite">{answer}</p>
        </div>
    )
}


import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { formatDate, hebrewDate, hebrewNumeral, yomTovName, dayLabel } from '@/app/lib/shas'
import { buildMetadata } from '@/app/lib/seo'

export const revalidate = 300

export const metadata = buildMetadata({
    title: 'Daf Yomi Discussion Archive – Every Daily Daf',
    description: 'Browse the complete archive of daily Daf Yomi discussion pages, with the articles and Gemara stories for each daf.',
    path: '/daily/archive',
})

const DAY = 86400000
const asDate = s => new Date(`${s}T00:00:00Z`)

export default async function DailyArchive() {
    // Comment counts come from an embedded count; if the relationship isn't available, show the list without them
    let { data: rows, error } = await supabase
        .from('daily_discussions')
        .select('id, date, masechta, daf, topic_summary, daily_comments(count)')
        .order('date', { ascending: false })
    if (error) {
        ({ data: rows } = await supabase.from('daily_discussions').select('id, date, masechta, daf, topic_summary').order('date', { ascending: false }))
    }
    rows = rows ?? []

    // Shabbos and Yom Tov between discussions appear as quiet rows, so the ledger has no unexplained gaps
    const entries = []
    for (let i = 0; i < rows.length; i++) {
        entries.push({ kind: 'day', row: rows[i], date: asDate(rows[i].date) })
        const older = rows[i + 1] && asDate(rows[i + 1].date)
        if (!older) continue
        for (let t = asDate(rows[i].date).getTime() - DAY; t > older.getTime(); t -= DAY) {
            const d = new Date(t)
            if (d.getUTCDay() === 6 || yomTovName(d)) entries.push({ kind: 'holy', date: d })
        }
    }

    const months = []
    for (const e of entries) {
        const name = formatDate(e.date, { month: 'long', year: 'numeric' })
        if (months.at(-1)?.name !== name) months.push({ name, items: [] })
        months.at(-1).items.push(e)
    }

    const grid = 'grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-3.5 gap-y-0.5 py-3.5 border-b border-rule items-baseline md:grid-cols-[9.5rem_8.5rem_minmax(0,1fr)_8rem]'

    return (
        <div className="folio py-6 md:py-8">
            <nav aria-label="Breadcrumb" className="crumbs"><Link href="/daily">Today’s Daf</Link></nav>
            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Past discussions</h1>
                <p className="text-lede text-ink-soft">Every day’s discussion, newest first.</p>
            </header>

            {rows.length === 0 && <p className="text-ink-soft py-4">Discussions appear here once they begin. <Link href="/daily">Go to today’s daf</Link>.</p>}

            {months.map(m => (
                <section key={m.name} aria-label={m.name}>
                    <h2 className="sc pt-6">{m.name}</h2>
                    {m.items.map(e => {
                        const label = dayLabel(e.date)
                        const dateCell = (
                            <span className="meta leading-snug">
                                {formatDate(e.date, { weekday: 'long', month: 'short', day: 'numeric' })}
                                <span lang="he" dir="rtl" className="block text-ink text-left">{hebrewDate(e.date, { year: false })}{label && label.short !== label.name ? ` · ${label.short}` : ''}</span>
                            </span>
                        )
                        if (e.kind === 'holy') {
                            return (
                                <div key={e.date.toISOString()} className={`${grid} bg-paper-sunk px-2.5`}>
                                    {dateCell}
                                    <span className="italic md:col-span-3">{yomTovName(e.date) ?? 'Shabbos Kodesh'} · no discussion</span>
                                </div>
                            )
                        }
                        const n = e.row.daily_comments?.[0]?.count
                        return (
                            <Link key={e.row.id} href={`/daily/${e.row.date}`} className={`plain ${grid} hover:bg-paper-sunk`}>
                                {dateCell}
                                <span className="text-[1.12rem]"><span lang="he" aria-hidden="true" className="numeral text-[1.5rem] mr-1.5">{hebrewNumeral(e.row.daf)}</span>{e.row.masechta} {e.row.daf}</span>
                                <span className="text-ink-soft text-[1.03rem] col-start-2 md:col-start-auto">{e.row.topic_summary || 'Discussion'}</span>
                                {typeof n === 'number' && <span className="meta col-start-2 md:col-start-auto md:text-right">{n === 0 ? 'No comments' : `${n} ${n === 1 ? 'comment' : 'comments'}`}</span>}
                            </Link>
                        )
                    })}
                </section>
            ))}
        </div>
    )
}

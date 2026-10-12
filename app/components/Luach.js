import Link from 'next/link'
import { dafPath } from '@/app/lib/articles'
import { weekOfDafim, hebrewNumeral, hebrewDateParts, hebrewDate } from '@/app/lib/shas'

// Weekdays as a luach prints them; the English is for screen readers
const DAYS = [['א׳', 'Sunday'], ['ב׳', 'Monday'], ['ג׳', 'Tuesday'], ['ד׳', 'Wednesday'], ['ה׳', 'Thursday'], ['ו׳', 'Friday'], ['ש״ק', 'Shabbos']]

// This week as a luach strip: weekday, daf, Hebrew date and any Yom Tov or Rosh Chodesh.
// `coverage` ({ from, to, masechta, href, label }) draws the gold bar under the days
// that week's article covers.
export default function Luach({ today, coverage }) {
    const week = weekOfDafim(today)
    const covered = coverage
        ? week.map((d, i) => (d.masechta.name === coverage.masechta && d.daf >= coverage.from && d.daf <= coverage.to ? i : -1)).filter(i => i >= 0)
        : []
    const first = covered[0], last = covered[covered.length - 1]
    const masechtos = [...new Set(week.map(d => d.masechta.name))].join(' – ')

    return (
        <div className="grid gap-1.5">
            <p className="flex flex-wrap justify-between gap-x-2 meta text-small">
                <span>This week · {masechtos}</span>
                <span lang="he" dir="rtl">{hebrewDate(week[0].date, { year: false })} – {hebrewDate(week[6].date, { year: false })}</span>
            </p>
            <div className="luach" role="list" aria-label="This week's dafim">
                {week.map((d, i) => (
                    <Link
                        key={d.date.toISOString()}
                        role="listitem"
                        href={d.isToday ? '/daily' : dafPath(d.masechta.name, d.daf)}
                        className="luach-day"
                        aria-current={d.isToday ? 'date' : undefined}
                        aria-label={`${DAYS[i][1]}: ${d.masechta.name} ${d.daf}${d.label ? `, ${d.label.name}` : ''}${d.isToday ? ', today' : ''}`}
                    >
                        <span lang="he" className="luach-wd" aria-hidden="true">{DAYS[i][0]}</span>
                        <span lang="he" className="luach-daf" aria-hidden="true">{hebrewNumeral(d.daf)}</span>
                        <span lang="he" className="luach-sub" aria-hidden="true">{hebrewNumeral(hebrewDateParts(d.date).day)}</span>
                        {d.label && <span lang={/[א-ת]/.test(d.label.short) ? 'he' : undefined} className="luach-label" aria-hidden="true">{d.label.short}</span>}
                    </Link>
                ))}
                {covered.length > 0 && (
                    <Link href={coverage.href} className="luach-span" style={{ gridColumn: `${first + 1} / ${last + 2}` }}>
                        <span>{coverage.label}</span>
                        <span className="whitespace-nowrap">{coverage.from}–{coverage.to}</span>
                    </Link>
                )}
            </div>
        </div>
    )
}

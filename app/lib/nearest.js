import { supabase } from './supabase'
import { ARTICLE_LIST_COLUMNS, orderByPublished } from './articles'
import { dafYomiFor, findMasechta, todayInNewYork } from './shas'

const DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos']

export const coversDaf = (a, name, daf) => findMasechta(a.masechta)?.name === name && a.daf <= daf && (a.daf_end ?? a.daf) >= daf

// How close an article's daf is to the day being viewed, in words a learner uses:
// "today's daf", "tomorrow's daf", "Thursday's daf, earlier this week", "next week's daf".
function closeness(offset, date, weekStart, isToday) {
    if (offset === 0) return isToday ? 'On today’s daf' : 'On this daf'
    if (offset === 1) return isToday ? 'On tomorrow’s daf' : 'On the next day’s daf'
    if (offset === -1) return isToday ? 'On yesterday’s daf' : 'On the day before’s daf'
    const day = WEEKDAYS[date.getUTCDay()]
    const weekEnd = weekStart + 6 * DAY
    if (date.getTime() >= weekStart && date.getTime() <= weekEnd) return `On ${day}’s daf, ${offset > 0 ? 'later' : 'earlier'} this week`
    return `On ${offset > 0 ? 'next' : 'last'} week’s daf · ${day}`
}

// The article on the given day's daf, or else the one nearest to it within last week, this
// week and next week. Nearest wins; on a tie, the coming daf beats the one already learned.
// Returns { article, day: { date, offset, masechta, daf }, label } or null.
export async function nearestDafArticle(date) {
    const isToday = date.getTime() === todayInNewYork().getTime()
    const weekStart = date.getTime() - date.getUTCDay() * DAY
    const start = weekStart - 7 * DAY
    const days = Array.from({ length: 21 }, (_, i) => {
        const d = new Date(start + i * DAY)
        return { date: d, offset: Math.round((d.getTime() - date.getTime()) / DAY), ...dafYomiFor(d) }
    }).sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || b.offset - a.offset)

    const spans = new Map()
    for (const d of days) {
        const s = spans.get(d.masechta.name) ?? { from: d.daf, to: d.daf }
        spans.set(d.masechta.name, { from: Math.min(s.from, d.daf), to: Math.max(s.to, d.daf) })
    }
    const lists = await Promise.all([...spans].map(async ([name, { from, to }]) => {
        const { data } = await orderByPublished(
            supabase.from('articles').select(ARTICLE_LIST_COLUMNS).ilike('masechta', name).lte('daf', to).or(`daf.gte.${from},daf_end.gte.${from}`)
        ).limit(40)
        return data ?? []
    }))
    const near = lists.flat()

    for (const d of days) {
        const article = near.find(a => coversDaf(a, d.masechta.name, d.daf))
        if (article) return { article, day: d, label: closeness(d.offset, d.date, weekStart, isToday) }
    }
    return null
}

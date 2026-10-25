import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { getArticlesForDaf, articlePath, dafLabel, dafPath, readingMinutes, ARTICLE_LIST_COLUMNS } from '@/app/lib/articles'
import { STORY_CARD_COLUMNS, storyPath } from '@/app/lib/stories'
import { findMasechta, dafYomiFor, hebrewNumeral, hebrewDate, dayLabel, siyumDate, siyumHaShasDate, formatDate, todayInNewYork } from '@/app/lib/shas'
import DailyDiscussion from './DailyDiscussion'
import Luach from './Luach'
import DafPicker from './DafPicker'
import { ArticleThumb } from './ArticleImage'
import { nearestDafArticle } from '@/app/lib/nearest'

const iso = d => d.toISOString().slice(0, 10)
const LONG = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

// One day of the Daf: the daf, the article that covers it, and that day's discussion.
// date: UTC midnight of the civil day. daily: the daily_discussions row, if one was set up.
export default async function DailyView({ date, daily, admin = false }) {
    const today = todayInNewYork()
    const computed = dafYomiFor(date)
    const masechta = findMasechta(daily?.masechta) ?? computed.masechta
    const daf = daily?.daf ?? computed.daf
    const label = dayLabel(date)
    const isToday = date.getTime() === today.getTime()

    const [articles, { data: stories }, { data: prev }, { data: next }, { data: recent }] = await Promise.all([
        getArticlesForDaf(masechta.name, daf, ARTICLE_LIST_COLUMNS),
        supabase.from('stories').select(STORY_CARD_COLUMNS).ilike('masechta', masechta.name).eq('daf', daf).order('position'),
        supabase.from('daily_discussions').select('date, masechta, daf').lt('date', iso(date)).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('daily_discussions').select('date, masechta, daf').gt('date', iso(date)).order('date', { ascending: true }).limit(1).maybeSingle(),
        daily ? { data: [] } : supabase.from('daily_discussions').select('date, masechta, daf, topic_summary').lte('date', iso(date)).order('date', { ascending: false }).limit(3),
    ])
    const article = articles[0]
    const nearest = article ? null : await nearestDafArticle(date)

    // The week's article, for the gold bar on the luach
    const coverage = article && findMasechta(article.masechta)
        ? { masechta: findMasechta(article.masechta).name, from: article.daf, to: article.daf_end ?? article.daf, href: articlePath(article), label: 'Covered by the article' }
        : null

    const dayLink = row => {
        const d = new Date(`${row.date}T00:00:00Z`)
        const sameAsToday = d.getTime() === today.getTime()
        return { href: sameAsToday ? '/daily' : `/daily/${row.date}`, label: `${formatDate(d, { weekday: 'long' })} · ${row.masechta} ${row.daf}` }
    }

    return (
        <>
            <div className="on-binding">
                <div className="folio grid gap-3 py-5 md:grid-cols-[auto_1fr] md:gap-x-7 md:items-end md:py-7">
                    <span lang="he" className="numeral sticker sticker-tilt self-start justify-self-start text-[clamp(3.5rem,8vw,5.25rem)] [border-color:#17181c]">{hebrewNumeral(daf)}</span>
                    <div>
                        <p className="meta">
                            {formatDate(date, LONG)} · <span lang="he" dir="rtl">{hebrewDate(date)}</span>
                            {label && <> · <b className="text-binding-ink font-semibold">{label.name}</b></>}
                        </p>
                        <h1 className="font-semibold text-[clamp(1.9rem,4.4vw,2.75rem)] leading-[1.05] tracking-[-0.02em]">
                            {isToday && <span className="sr-only">Today: </span>}{masechta.name} {daf}
                        </h1>
                        {daily?.topic_summary && <p className="text-binding-soft text-[1.06rem] mt-1.5 max-w-[60ch]">{daily.topic_summary}</p>}
                    </div>
                    <div className="md:col-span-2 pt-2"><Luach today={date} coverage={coverage} /></div>
                    <nav aria-label="Other days" className="flex flex-wrap gap-1.5 md:col-span-2">
                        {prev && <Link href={dayLink(prev).href} className="btn-quiet">← {dayLink(prev).label}</Link>}
                        {next && <Link href={dayLink(next).href} className="btn-quiet">{dayLink(next).label} →</Link>}
                        {!isToday && <Link href="/daily" className="btn-quiet">Today’s daf</Link>}
                    </nav>
                </div>
            </div>

            <div className="folio py-6">
                <div className="grid gap-1 pb-4 border-b border-rule-hard">
                    {article ? (
                        <>
                            <div className="card grid-cols-[7.5rem_minmax(0,1fr)] md:grid-cols-[11rem_minmax(0,1fr)] gap-x-4 items-start">
                                <ArticleThumb article={article} sizes="(min-width: 768px) 11rem, 7.5rem" className="row-span-3" />
                                <span className="sc">Covered in the article</span>
                                <b className="card-title text-[1.32rem]"><Link href={articlePath(article)}>{article.title}</Link></b>
                                <span className="meta">
                                    {article.masechta} {dafLabel(article)}
                                    {article.content && ` · ${readingMinutes(article)} min read`}
                                </span>
                            </div>
                            {articles.length > 1 && <Link href={dafPath(masechta.name, daf)} className="tap justify-self-start relative z-[1]">And {articles.length - 1} more {articles.length === 2 ? 'article' : 'articles'} on this daf</Link>}
                        </>
                    ) : (
                        <>
                            <span className="sc">No article on {masechta.name} {daf} yet</span>
                            {nearest ? (
                                <div className="card grid-cols-[7.5rem_minmax(0,1fr)] md:grid-cols-[11rem_minmax(0,1fr)] gap-x-4 items-start mt-2">
                                    <ArticleThumb article={nearest.article} sizes="(min-width: 768px) 11rem, 7.5rem" className="row-span-3" />
                                    <span className="kicker">{nearest.label} · {nearest.day.masechta.name} {nearest.day.daf}</span>
                                    <b className="card-title text-[1.32rem]"><Link href={articlePath(nearest.article)}>{nearest.article.title}</Link></b>
                                    <span className="meta">
                                        {nearest.article.masechta} {dafLabel(nearest.article)}
                                        {nearest.article.content && ` · ${readingMinutes(nearest.article)} min read`}
                                    </span>
                                </div>
                            ) : (
                                <Link href={dafPath(masechta.name, daf)} className="tap">See the nearest article</Link>
                            )}
                        </>
                    )}
                    {stories?.length > 0 && (
                        <p className="meta">Stories on this daf: {stories.map((s, i) => <span key={s.id}>{i > 0 && ', '}<Link href={storyPath(s)}>{s.title}</Link></span>)}</p>
                    )}
                </div>

                <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-x-9">
                    <div>
                        {daily ? (
                            <DailyDiscussion dailyId={daily.id} isAdmin={admin} title={isToday ? "Today's daf discussion" : 'Discussion'} />
                        ) : (
                            <section aria-labelledby="recent-d">
                                <h2 id="recent-d" className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">Recent discussions</h2>
                                {recent?.length ? recent.map(r => (
                                    <Link key={r.date} href={dayLink(r).href} className="plain grid py-3 border-b border-rule hover:bg-paper-sunk">
                                        <b className="font-semibold">{formatDate(new Date(`${r.date}T00:00:00Z`), { weekday: 'long', month: 'long', day: 'numeric' })} · {r.masechta} {r.daf}</b>
                                        {r.topic_summary && <span className="meta">{r.topic_summary}</span>}
                                    </Link>
                                )) : <p className="meta py-3">Discussions appear here when Rabbi Sebrow opens one.</p>}
                            </section>
                        )}
                    </div>

                    <aside aria-label="This week" className="grid gap-5 content-start lg:border-l lg:border-rule lg:pl-6">
                        <DafPicker id="daily-picker" initialMasechta={masechta.name} initialDaf={daf} />
                        <div className="grid gap-0.5">
                            <span className="sc">Siyumim</span>
                            <p>{computed.masechta.name}: {formatDate(siyumDate(computed.masechta, date), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                            <p>Siyum HaShas: {formatDate(siyumHaShasDate(date), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <Link href="/daily/archive" className="tap">Past discussions</Link>
                    </aside>
                </div>
            </div>
        </>
    )
}

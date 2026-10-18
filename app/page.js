// app/page.js
import Link from 'next/link'
import { supabase } from './lib/supabase'
import { ARTICLE_LIST_COLUMNS, articlePath, articleOpening, dafLabel, dafPath, formatArticleDate, onDaf, orderByPublished, readingMinutes } from './lib/articles'
import { STORY_CARD_COLUMNS } from './lib/stories'
import { MASECHTOS, SEDARIM, findMasechta, masechtaHref, todayInNewYork, dafYomiFor, weekOfDafim, hebrewNumeral, dayLabel, siyumDate, formatDate } from './lib/shas'
import { buildMetadata } from './lib/seo'
import { TOPICS, countTopics, topicPath } from './lib/topics'
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION } from './lib/site'
import StoryRow from './components/StoryRow'
import { ArticleThumb } from './components/ArticleImage'
import DafPicker from './components/DafPicker'
import { AuthorStrip } from './components/Author'
import { nearestDafArticle, coversDaf } from './lib/nearest'

// Cached for 5 minutes, so today's daf turns over shortly after midnight in New York.
// Publishing from /admin or the story pipeline refreshes it immediately.
export const revalidate = 300

export const metadata = buildMetadata({
    absoluteTitle: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
})

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos']

const shortDate = a => formatArticleDate(a, { month: 'short', day: 'numeric', year: 'numeric' })

export default async function Home() {
    const today = todayInNewYork()
    const todays = dafYomiFor(today)
    const week = weekOfDafim(today)
    const label = dayLabel(today)

    // The lead: an article on today's daf, else the nearest daf from last week to next week
    const [recentRes, storiesRes, indexRes, lead] = await Promise.all([
        orderByPublished(onDaf(supabase.from('articles').select(ARTICLE_LIST_COLUMNS))).limit(11),
        supabase.from('stories').select(STORY_CARD_COLUMNS).order('created_at', { ascending: false }).limit(3),
        supabase.from('articles').select('masechta, tags'),
        nearestDafArticle(today),
    ])
    const recent = recentRes.data ?? []
    const stories = storiesRes.data ?? []
    const index = indexRes.data ?? []

    const featured = lead?.article ?? recent[0] ?? null
    const kicker = lead ? lead.label : 'Recently added'
    const rest = recent.filter(a => a.id !== featured?.id)
    const also = rest.slice(0, 4)
    const more = rest.slice(4, 10).length >= 4 ? rest.slice(4, 10) : rest.slice(0, 6)

    // This week's dafim that have the lead article, for the today panel
    const leadCovers = d => lead && coversDaf(lead.article, d.masechta.name, d.daf)

    // The seder being learned now, each masechta as a bar as long as the masechta
    const counts = new Map()
    for (const a of index) {
        const m = findMasechta(a.masechta)
        if (m) counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
    }
    const seder = MASECHTOS.filter(m => m.seder === todays.masechta.seder && m.dafim > 8)
    const longest = Math.max(...seder.map(m => m.dafim))

    // Most-used topics, by their clean names from data/topics.json
    const tagCounts = countTopics(index)
    const topTags = TOPICS
        .filter(t => tagCounts.get(t.slug))
        .map(t => [t, tagCounts.get(t.slug)])
        .sort((a, b) => b[1] - a[1]).slice(0, 10)

    return (
        <div data-home className="folio pt-6 md:pt-10 pb-10 grid gap-12 md:gap-16">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 items-start">
                {/* The lead article, set beside its daf numeral */}
                {featured ? (
                    <article className="grid gap-5 md:grid-cols-[8.5rem_minmax(0,1fr)] md:gap-x-8" aria-labelledby="lead-h">
                        <div className="flex md:flex-col items-center md:items-start gap-3">
                            {featured.masechta && <span lang="he" aria-hidden="true" className="numeral sticker text-[3rem] md:text-[4.5rem]">{hebrewNumeral(featured.daf)}</span>}
                            <p className="meta">
                                {featured.masechta ? `${featured.masechta} ${dafLabel(featured)}` : 'Beyond the Daf'}
                                {featured.content && <><br />{readingMinutes(featured)} min read</>}
                            </p>
                        </div>
                        <div className="grid gap-5 content-start min-w-0">
                            <p className="kicker">{kicker}{lead && lead.day.offset !== 0 ? ` · ${lead.day.masechta.name} ${lead.day.daf}` : ''}{!lead ? ` · ${shortDate(featured)}` : ''}</p>
                            <h1 id="lead-h" className="text-[clamp(2.3rem,5.6vw,4.2rem)] leading-[1.05] lead-title">
                                <Link href={articlePath(featured)} className="hl">{featured.title}</Link>
                            </h1>
                            <Link href={articlePath(featured)} tabIndex={-1} aria-hidden="true" className="block">
                                <ArticleThumb article={featured} priority className="aspect-[2/1]" sizes="(min-width: 1024px) 640px, 100vw" />
                            </Link>
                            <p className="text-lede text-ink-soft max-w-[54ch]">{articleOpening(featured, 320)}</p>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                <Link href={articlePath(featured)} className="btn">Read the article</Link>
                                <Link href="/articles" className="tap">All articles</Link>
                            </div>
                            {also.length > 0 && (
                                <section aria-labelledby="also-h" className="max-md:hidden grid gap-2 pt-2">
                                    <h2 id="also-h" className="font-serif text-ui font-bold">Also recently</h2>
                                    <ul className="grid grid-cols-2 gap-3">
                                        {also.map(a => (
                                            <li key={a.id} className="index-card relative px-4 py-3 hover:border-foil-ink">
                                                <p className="meta">{a.masechta ? `${a.masechta} ${dafLabel(a)}` : 'Beyond the Daf'}</p>
                                                <h3 className="text-[1.1rem] leading-snug"><Link href={articlePath(a)} className="plain hover:underline after:absolute after:inset-0">{a.title}</Link></h3>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </div>
                    </article>
                ) : (
                    <div className="grid gap-3">
                        <h1 className="text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.05]"><span className="hl">Daf Yomi Insights</span></h1>
                        <p className="text-lede text-ink-soft">Articles are on their way. In the meantime, follow <Link href="/daily">today’s daf</Link>.</p>
                    </div>
                )}

                {/* Today's daf: the learner's place this week */}
                <section aria-labelledby="today-h" className="today-panel">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 items-center">
                        <span lang="he" aria-hidden="true" className="numeral sticker sticker-tilt today-num row-span-2">{hebrewNumeral(todays.daf)}</span>
                        <p className="text-small">Today · {formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}{label ? ` · ${label.name}` : ''}</p>
                        <h2 id="today-h" className="text-[1.75rem] leading-tight">{todays.masechta.name} {todays.daf}</h2>
                    </div>
                    <Link href="/daily" className="btn w-full">Join today’s discussion</Link>
                    <ol className="week-rows" aria-label="This week’s dafim">
                        {week.map((d, i) => (
                            <li key={d.date.toISOString()}>
                                <Link
                                    href={d.isToday ? '/daily' : dafPath(d.masechta.name, d.daf)}
                                    className="week-row"
                                    aria-current={d.isToday ? 'date' : undefined}
                                >
                                    <span>{WEEKDAYS[i]}</span>
                                    <span lang="he" aria-hidden="true" className="numeral">{hebrewNumeral(d.daf)}</span>
                                    <span>{d.masechta.name !== todays.masechta.name ? `${d.masechta.name} ` : ''}{d.daf}</span>
                                    <span className="week-tag">{d.isToday ? 'today' : leadCovers(d) ? 'article' : d.label?.short ?? ''}</span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                    <p className="text-small flex items-baseline gap-2">Siyum {todays.masechta.name}<i className="flex-1 border-b border-dotted border-[#17181c] -translate-y-1" /><span className="whitespace-nowrap">{formatDate(siyumDate(todays.masechta, today), { weekday: 'short', month: 'short', day: 'numeric' })}</span></p>
                </section>
            </div>

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 items-start">
                {/* More articles as index cards */}
                {more.length > 0 && (
                    <section aria-labelledby="more-h">
                        <div className="sec-head">
                            <h2 id="more-h" className="sec-title"><span className="hl">More articles</span></h2>
                            <Link href="/articles" className="tap shrink-0">All articles</Link>
                        </div>
                        <ul className="grid gap-4 sm:grid-cols-2">
                            {more.map(a => (
                                <li key={a.id} className="index-card relative grid gap-2 content-start p-5 hover:border-foil-ink">
                                    <div className="flex items-start justify-between gap-3 pb-2 border-b-[3px] border-double border-rule-hard">
                                        <p className="meta">{a.masechta ? `${a.masechta} ${dafLabel(a)}` : 'Beyond the Daf'} · {shortDate(a)}</p>
                                        {a.masechta && <span lang="he" aria-hidden="true" className="numeral text-[1.6rem] text-foil-ink shrink-0">{hebrewNumeral(a.daf)}</span>}
                                    </div>
                                    <h3 className="card-title"><Link href={articlePath(a)} className="plain hover:underline after:absolute after:inset-0">{a.title}</Link></h3>
                                    <p className="card-text text-[1.05rem]">{articleOpening(a, 200)}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Masechtos and topics, read left to right */}
                <aside className="grid gap-10 content-start">
                    <section aria-labelledby="seder-h">
                        <div className="sec-head">
                            <h2 id="seder-h" className="sec-title"><span className="hl">Seder {todays.masechta.seder}</span> <span lang="he" className="numeral text-[1.1rem] text-foil-ink">{SEDARIM.find(x => x.name === todays.masechta.seder)?.hebrew}</span></h2>
                        </div>
                        <ul className="grid gap-1.5">
                            {seder.map(m => {
                                const n = counts.get(m.name) ?? 0
                                const now = m.name === todays.masechta.name
                                return (
                                    <li key={m.name}>
                                        <Link
                                            href={masechtaHref(m.name)}
                                            className={`seder-bar ${now ? 'is-now' : ''}`}
                                            style={{ '--len': `${Math.round((m.dafim / longest) * 100)}%` }}
                                        >
                                            <span className="font-semibold">{m.name}{now && <span className="text-foil-ink"> · now</span>}</span>
                                            <span lang="he" className="numeral ms-auto">{m.hebrew}</span>
                                            <span className="text-small w-[5.5rem] text-right">{n} {n === 1 ? 'article' : 'articles'}</span>
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                        <div className="mt-4"><DafPicker id="home-picker" initialMasechta={todays.masechta.name} initialDaf={todays.daf} /></div>
                        <Link href="/masechtos" className="tap">All masechtos</Link>
                    </section>
                    {topTags.length > 0 && (
                        <section aria-labelledby="topics-h">
                            <div className="sec-head">
                                <h2 id="topics-h" className="sec-title"><span className="hl">Browse by topic</span></h2>
                            </div>
                            <ul className="grid">
                                {topTags.map(([topic, n]) => (
                                    <li key={topic.slug}>
                                        <Link href={topicPath(topic)} className="plain flex items-baseline gap-2 min-h-11 py-2 border-b border-rule hover:underline">
                                            {topic.name}<span className="ms-auto meta">{n}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <Link href="/topics" className="tap">All topics</Link>
                        </section>
                    )}
                </aside>
            </div>

            {stories.length > 0 && (
                <section aria-labelledby="stories-h">
                    <div className="sec-head">
                        <h2 id="stories-h" className="sec-title"><span className="hl">Stories from the Gemara</span></h2>
                        <Link href="/stories" className="tap shrink-0">All stories</Link>
                    </div>
                    {stories.map(s => <StoryRow key={s.id} story={s} />)}
                </section>
            )}

            <AuthorStrip />
        </div>
    )
}

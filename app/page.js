// app/page.js
import Link from 'next/link'
import { supabase } from './lib/supabase'
import { ARTICLE_LIST_COLUMNS, articlePath, articleOpening, dafLabel, formatArticleDate, orderByPublished, readingMinutes } from './lib/articles'
import { STORY_CARD_COLUMNS } from './lib/stories'
import { MASECHTOS, SEDARIM, findMasechta, masechtaHref, todayInNewYork, dafYomiFor, weekOfDafim, hebrewNumeral, dayLabel, siyumDate, formatDate } from './lib/shas'
import { buildMetadata } from './lib/seo'
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION } from './lib/site'
import StoryRow from './components/StoryRow'
import { ArticleThumb } from './components/ArticleImage'
import Luach from './components/Luach'
import DafPicker from './components/DafPicker'
import { AuthorStrip } from './components/Author'

// Cached for 5 minutes, so today's daf turns over shortly after midnight in New York.
// Publishing from /admin or the story pipeline refreshes it immediately.
export const revalidate = 300

export const metadata = buildMetadata({
    absoluteTitle: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
})

// Articles in a masechta whose range (daf..daf_end) overlaps from..to
async function articlesOverlapping(masechta, from, to) {
    const { data } = await orderByPublished(
        supabase.from('articles').select(ARTICLE_LIST_COLUMNS).ilike('masechta', masechta).lte('daf', to).or(`daf.gte.${from},daf_end.gte.${from}`)
    ).limit(3)
    return data ?? []
}

const shortDate = a => formatArticleDate(a, { month: 'short', day: 'numeric', year: 'numeric' })

export default async function Home() {
    const today = todayInNewYork()
    const todays = dafYomiFor(today)
    const week = weekOfDafim(today)
    const label = dayLabel(today)

    // The week can span two masechtos
    const spans = new Map()
    for (const d of week) {
        const s = spans.get(d.masechta.name) ?? { from: d.daf, to: d.daf }
        spans.set(d.masechta.name, { from: Math.min(s.from, d.daf), to: Math.max(s.to, d.daf) })
    }

    const [recentRes, storiesRes, indexRes, ...weekLists] = await Promise.all([
        orderByPublished(supabase.from('articles').select(ARTICLE_LIST_COLUMNS)).limit(11),
        supabase.from('stories').select(STORY_CARD_COLUMNS).order('created_at', { ascending: false }).limit(3),
        supabase.from('articles').select('masechta, tags'),
        ...[...spans].map(([name, r]) => articlesOverlapping(name, r.from, r.to)),
    ])
    const recent = recentRes.data ?? []
    const stories = storiesRes.data ?? []
    const index = indexRes.data ?? []

    // This week's article: one covering today's daf, otherwise any covering this week's dafim
    const weekArticles = weekLists.flat()
    const covers = (a, name, daf) => findMasechta(a.masechta)?.name === name && a.daf <= daf && (a.daf_end ?? a.daf) >= daf
    const weekArticle = weekArticles.find(a => covers(a, todays.masechta.name, todays.daf)) ?? weekArticles[0] ?? null
    const featured = weekArticle ?? recent[0] ?? null
    const rest = recent.filter(a => a.id !== featured?.id)
    const margin = rest.slice(0, 3)
    const mosaic = rest.slice(0, 9)
    const featuredMasechta = featured && findMasechta(featured.masechta)

    const coverage = weekArticle && findMasechta(weekArticle.masechta)
        ? { masechta: findMasechta(weekArticle.masechta).name, from: weekArticle.daf, to: weekArticle.daf_end ?? weekArticle.daf, href: articlePath(weekArticle), label: "This week's article" }
        : null

    // Shelf: the seder being learned now, each spine as wide as its masechta is long
    const counts = new Map()
    for (const a of index) {
        const m = findMasechta(a.masechta)
        if (m) counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
    }
    const seder = MASECHTOS.filter(m => m.seder === todays.masechta.seder && m.dafim > 8)

    const tagCounts = new Map()
    for (const a of index) for (const t of a.tags ?? []) if (t?.trim()) tagCounts.set(t.trim(), (tagCounts.get(t.trim()) ?? 0) + 1)
    const topTags = [...tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 6).sort((a, b) => a[0].localeCompare(b[0]))

    return (
        <div data-home>
            {/* The front page set as a daf: folio in the margin, the article in the Gemara block,
                more reading in the Tosafos margin */}
            {featured ? (
                <div className="folio pt-6 md:pt-8 pb-8 md:pb-10">
                    <p className="runhead">
                        <span><b className="font-medium text-foil-ink">{weekArticle ? 'This week’s article' : 'Recently added'}</b> · {featured.masechta} {dafLabel(featured)} · {shortDate(featured)}</span>
                        {featuredMasechta && <span lang="he" dir="rtl">מסכת {featuredMasechta.hebrew} · דף {hebrewNumeral(featured.daf)}</span>}
                    </p>
                    <div className="tzurah pt-5">
                        <div className="tzurah-margin">
                            <span lang="he" aria-hidden="true" className="numeral text-[3rem] lg:text-[6rem] leading-[0.85]">{hebrewNumeral(featured.daf)}</span>
                            <p className="meta">
                                {featured.masechta} {dafLabel(featured)}
                                {featured.content && <><br />{readingMinutes(featured)} min read</>}
                                {featured.tags?.length > 0 && <span className="max-lg:hidden"><br />{featured.tags.slice(0, 3).map((t, i) => <span key={t}>{i ? ', ' : ''}<Link href={`/topics/${encodeURIComponent(t)}`} className="inline-flex items-center min-h-11">{t}</Link></span>)}</span>}
                            </p>
                        </div>
                        <article className="tzurah-gemara grid gap-4 content-start">
                            <h1 className="font-medium text-[clamp(2.3rem,5.4vw,4rem)] leading-[1] tracking-[-0.02em] [font-variation-settings:'opsz'_72]">
                                <Link href={articlePath(featured)} className="plain hover:underline">{featured.title}</Link>
                            </h1>
                            {featured.image_url && (
                                <Link href={articlePath(featured)} tabIndex={-1} aria-hidden="true" className="block">
                                    <ArticleThumb article={featured} priority className="aspect-[2/1]" sizes="(min-width: 1024px) 640px, 100vw" />
                                </Link>
                            )}
                            <p className="text-lede text-ink-soft max-w-[52ch]">{articleOpening(featured, 320)}</p>
                            <Link href={articlePath(featured)} className="btn justify-self-start">Read the article</Link>
                        </article>
                        {margin.length > 0 && (
                            <aside aria-labelledby="also-h" className="tzurah-tosafos max-lg:hidden">
                                <h2 id="also-h" className="text-ui font-semibold pb-1.5">Also recently</h2>
                                <ul>
                                    {margin.map(a => (
                                        <li key={a.id} className="card grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 items-start py-3 border-t border-rule">
                                            <ArticleThumb article={a} sizes="5.5rem" />
                                            <div>
                                                <p className="meta">{a.masechta} {dafLabel(a)}</p>
                                                <h3 className="card-title text-[1.125rem]"><Link href={articlePath(a)}>{a.title}</Link></h3>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/articles" className="tap">All articles</Link>
                            </aside>
                        )}
                    </div>
                </div>
            ) : (
                <div className="folio py-10">
                    <h1 className="font-medium text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]">Daf Yomi Insights</h1>
                    <p className="text-lede text-ink-soft mt-2">Articles are on their way. In the meantime, follow <Link href="/daily">today’s daf</Link>.</p>
                </div>
            )}

            {/* The week, bound in black */}
            <section aria-labelledby="week-h" className="on-binding border-t-2 border-foil">
                <div className="folio py-6 grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10 lg:items-center">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 items-center">
                        <span lang="he" aria-hidden="true" className="numeral text-[4rem] text-foil row-span-3">{hebrewNumeral(todays.daf)}</span>
                        <p className="sc">Today{label ? ` · ${label.name}` : ''}</p>
                        <h2 id="week-h" className="text-[1.5rem] leading-tight font-semibold">{todays.masechta.name} {todays.daf}</h2>
                        <Link href="/daily" className="btn-quiet justify-self-start mt-2">Join today’s discussion</Link>
                    </div>
                    <Luach today={today} coverage={coverage} />
                    <div className="lg:hidden"><DafPicker id="band-picker" initialMasechta={todays.masechta.name} initialDaf={todays.daf} /></div>
                </div>
            </section>

            <div className="folio py-8 md:py-10 grid gap-10">
                {/* More articles, picture first */}
                {mosaic.length > 0 && (
                    <section aria-labelledby="more-h" className={rest.length > 3 ? '' : 'lg:hidden'}>
                        <div className="flex items-baseline justify-between gap-3 border-b border-rule-hard pb-2 mb-5">
                            <h2 id="more-h" className="font-semibold text-h2 tracking-[-0.02em]">More articles</h2>
                            <Link href="/articles" className="tap shrink-0 meta">All articles</Link>
                        </div>
                        <div className="mosaic">
                            {mosaic.map((a, i) => (
                                <article key={a.id} className={['card', i < 3 && 'lg:hidden', i === 0 && 'lead-sm', i === 3 && 'lead-lg', i >= 6 && 'as-row'].filter(Boolean).join(' ')}>
                                    <ArticleThumb article={a} sizes={i === 0 || i === 3 ? '(min-width: 1024px) 760px, 100vw' : '(min-width: 1024px) 360px, 50vw'} />
                                    <p className="meta">{a.masechta} {dafLabel(a)}<span className={i === 0 ? '' : 'max-lg:hidden'}> · {shortDate(a)}</span></p>
                                    <h3 className={`card-title ${i === 0 ? 'max-lg:text-[clamp(1.5rem,5vw,2.1rem)] max-lg:leading-[1.08]' : ''} ${i === 3 ? 'lg:text-[2.1rem] lg:leading-[1.08]' : ''}`}><Link href={articlePath(a)}>{a.title}</Link></h3>
                                    <p className={`card-text ${i === 0 ? '' : 'max-lg:[-webkit-line-clamp:2] max-lg:text-ui'}`}>{articleOpening(a, i === 0 || i === 3 ? 280 : 200)}</p>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-x-10">
                    {stories.length > 0 && (
                        <section aria-labelledby="stories-h">
                            <div className="flex items-baseline justify-between gap-3 border-b border-rule-hard pb-2">
                                <h2 id="stories-h" className="font-semibold text-h2 tracking-[-0.02em]">Stories from the Gemara</h2>
                                <Link href="/stories" className="tap shrink-0 meta">All stories</Link>
                            </div>
                            {stories.map(s => <StoryRow key={s.id} story={s} />)}
                        </section>
                    )}
                    <div className="grid gap-5 content-start lg:col-start-2 lg:border-l lg:border-rule lg:pl-8">
                        <div className="max-lg:hidden"><DafPicker id="home-picker" initialMasechta={todays.masechta.name} initialDaf={todays.daf} /></div>
                        <p className="flex items-baseline gap-2 min-h-11 py-2">Siyum on {todays.masechta.name}<i className="flex-1 border-b border-dotted border-ink-soft -translate-y-1" /><span className="meta whitespace-nowrap">{formatDate(siyumDate(todays.masechta, today), { weekday: 'short', month: 'short', day: 'numeric' })}</span></p>
                    </div>
                </div>
            </div>

            {/* The shelf */}
            <section aria-label="Browse" className="bg-paper-sunk border-y border-rule">
                <div className="folio py-8 grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-12">
                    <div>
                        <h2 className="font-semibold text-h2 tracking-[-0.02em]">Masechtos</h2>
                        <p className="meta mt-1"><span lang="he" className="text-[1.05rem] text-ink">סדר {SEDARIM.find(x => x.name === todays.masechta.seder)?.hebrew}</span> · Seder {todays.masechta.seder}, being learned now</p>
                        <ol className="flex flex-wrap items-end gap-1 pt-4" aria-label={`Seder ${todays.masechta.seder}`}>
                            {seder.map(m => {
                                const n = counts.get(m.name) ?? 0
                                const now = m.name === todays.masechta.name
                                const Spine = n ? Link : 'span'
                                return (
                                    <li key={m.name}>
                                        <Spine
                                            href={n ? masechtaHref(m.name) : undefined}
                                            aria-label={`${m.name}${now ? ', learning now' : ''}, ${n} ${n === 1 ? 'article' : 'articles'}`}
                                            className={`plain flex flex-col items-center justify-between h-[9rem] py-2 px-1 border-t-2 ${n ? 'on-binding border-foil' : 'border-rule text-ink-soft outline outline-1 -outline-offset-1 outline-rule hover:bg-paper'} ${now ? 'outline-2 outline outline-foil-ink outline-offset-2' : ''}`}
                                            style={{ width: `${44 + Math.round((m.dafim / 176) * 28)}px` }}
                                        >
                                            <span className="[writing-mode:vertical-rl] rotate-180 text-ui">{m.name}</span>
                                            <span className="font-mono text-small text-foil">{n || ''}</span>
                                        </Spine>
                                    </li>
                                )
                            })}
                        </ol>
                        <Link href="/masechtos" className="tap meta">All masechtos</Link>
                    </div>
                    {topTags.length > 0 && (
                        <div>
                            <h2 className="font-semibold text-h2 tracking-[-0.02em]">Topics</h2>
                            <ul className="mt-2">
                                {topTags.map(([tag, n]) => (
                                    <li key={tag}>
                                        <Link href={`/topics/${encodeURIComponent(tag)}`} className="plain flex items-baseline gap-2 min-h-11 py-2 text-[1.08rem] hover:underline">
                                            {tag}<i className="flex-1 border-b border-dotted border-ink-soft -translate-y-1" /><span className="meta whitespace-nowrap">{n}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <Link href="/topics" className="tap meta">All topics</Link>
                        </div>
                    )}
                </div>
            </section>

            <div className="folio py-8"><AuthorStrip /></div>
        </div>
    )
}


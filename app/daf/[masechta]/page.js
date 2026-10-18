import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { ARTICLE_LIST_COLUMNS, articlePath, getArticlesReferencing } from '@/app/lib/articles'
import { findMasechta, titleCase, masechtaHref, masechtaFromParam, masechtaSlug, todayInNewYork, dafYomiFor, siyumDate, dateOfDaf, formatDate } from '@/app/lib/shas'
import { buildMetadata, breadcrumbJsonLd, collectionJsonLd } from '@/app/lib/seo'
import { getStoriesInMasechta } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import ArticleRow from '@/app/components/ArticleRow'
import StoryRow from '@/app/components/StoryRow'

export const revalidate = 300

function displayName(masechta) {
    return findMasechta(masechta)?.name ?? titleCase(masechta)
}

export async function generateMetadata({ params }) {
    const masechta = masechtaFromParam((await params).masechta)
    const formattedName = displayName(masechta)

    return buildMetadata({
        title: `Maseches ${formattedName} – Daf Yomi Articles, Stories & Insights`,
        description: `Daf Yomi articles, Gemara stories and insights on every daf of Maseches ${formattedName}, by Rabbi Avrohom Sebrow.`,
        path: masechtaHref(masechta),
        keywords: [`${formattedName} Daf Yomi`, `Maseches ${formattedName}`, `${formattedName} Gemara stories`, `Tractate ${formattedName}`],
    })
}

const SHORT = { weekday: 'long', month: 'long', day: 'numeric' }

export default async function MasechtaPage({ params }) {
    const raw = (await params).masechta
    const masechta = masechtaFromParam(raw)
    const known = findMasechta(masechta)
    // /daf/bava%20metzia and /daf/menachot -> /daf/bava-metzia, /daf/menachos
    if (known && raw !== masechtaSlug(known.name)) permanentRedirect(masechtaHref(known.name))
    const name = displayName(masechta)

    const [{ data }, stories, referencing] = await Promise.all([
        supabase
            .from('articles')
            .select(ARTICLE_LIST_COLUMNS)
            .ilike('masechta', masechta)
            .order('daf', { ascending: true })
            .order('published_at', { ascending: false, nullsFirst: false }),
        getStoriesInMasechta(masechta, { limit: 500 }),
        getArticlesReferencing(known?.name ?? masechta, `${ARTICLE_LIST_COLUMNS}, refs`),
    ])
    // Articles filed under another masechta that also discuss this one are listed
    // at the daf they discuss here
    const own = data ?? []
    // A made-up masechta name in the URL is a real 404, not an empty page
    if (!known && own.length === 0) notFound()
    const ownIds = new Set(own.map(a => a.id))
    const alsoHere = referencing
        .filter(a => !ownIds.has(a.id))
        .flatMap(a => (a.refs ?? [])
            .filter(r => r.masechta === (known?.name ?? masechta))
            .slice(0, 1)
            .map(r => ({ ...a, daf: r.daf, daf_end: r.daf_end ?? null, listedVia: r })))
    const articles = [...own, ...alsoHere].sort((a, b) => a.daf - b.daf)

    const today = todayInNewYork()
    const todays = dafYomiFor(today)
    const learningNow = known && todays.masechta.name === known.name
    const siyum = known ? siyumDate(known, today) : null
    const begins = known ? dateOfDaf(known.name, known.first, today) : null

    // Which article covers each daf, for the map
    const coveredBy = new Map()
    for (const a of articles) {
        for (let d = a.daf; d <= (a.daf_end ?? a.daf); d++) if (!coveredBy.has(d)) coveredBy.set(d, a)
    }

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={breadcrumbJsonLd([{ name: 'Masechtos', path: '/masechtos' }, { name, path: masechtaHref(name) }])} />
            <JsonLd data={collectionJsonLd({
                name: `Maseches ${name}`,
                description: `Daf Yomi articles on Maseches ${name}`,
                path: masechtaHref(name),
                items: articles.map(a => ({ name: a.title, path: articlePath(a) })),
            })} />

            <nav aria-label="Breadcrumb" className="crumbs">
                <Link href="/masechtos">Masechtos</Link>
                {known && <><span aria-hidden="true">›</span><Link href={`/masechtos#${known.seder.toLowerCase()}`}>Seder {known.seder}</Link></>}
            </nav>

            <header className="grid gap-1.5 pb-4 border-b border-rule-hard md:grid-cols-[auto_1fr] md:gap-x-7 md:items-end">
                {known && <span lang="he" className="numeral text-[clamp(3.75rem,10vw,6.75rem)] leading-[0.9]">{known.hebrew}</span>}
                <div>
                    {known && <p className="sc">Seder {known.seder} · dafim {known.first}–{known.last}</p>}
                    <h1 className="font-semibold text-[clamp(2rem,4.6vw,3rem)] leading-none tracking-[-0.02em]">{name}</h1>
                    <p className="note mt-1.5">
                        {learningNow && <>Learning now: daf {todays.daf}. Siyum {formatDate(siyum, SHORT)}. </>}
                        {!learningNow && siyum && (siyum < today ? `Finished ${formatDate(siyum, { month: 'long', day: 'numeric', year: 'numeric' })} in this cycle. ` : `Begins ${formatDate(begins, { month: 'long', day: 'numeric', year: 'numeric' })}. `)}
                        {articles.length} {articles.length === 1 ? 'article' : 'articles'}{stories.length ? `, ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}` : ''}
                    </p>
                </div>
            </header>

            {known && (
                <section aria-labelledby="map-h" className="py-4 border-b border-rule">
                    <h2 id="map-h" className="sr-only">Map of the dafim</h2>
                    <ol className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-20 gap-[3px]" aria-label={`Dafim of ${name}`}>
                        {Array.from({ length: known.dafim }, (_, i) => known.first + i).map(d => {
                            const a = coveredBy.get(d)
                            const isToday = learningNow && d === todays.daf
                            const base = `grid place-items-center min-h-11 md:min-h-[2.2rem] text-small [font-variant-numeric:lining-nums_tabular-nums] ${isToday ? 'outline-2 outline outline-ink outline-offset-1' : ''}`
                            return (
                                <li key={d}>
                                    {a ? (
                                        <Link href={articlePath(a)} className={`plain ${base} bg-foil text-[#17181c] font-semibold border border-foil-ink`} aria-label={`Daf ${d}: ${a.title}${isToday ? ' (today)' : ''}`}>{d}</Link>
                                    ) : (
                                        <span className={`${base} bg-paper-sunk text-ink-soft`} aria-label={`Daf ${d}, no article yet${isToday ? ' (today)' : ''}`}>{d}</span>
                                    )}
                                </li>
                            )
                        })}
                    </ol>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 meta mt-2.5">
                        <span><i className="inline-block w-3.5 h-3.5 align-[-2px] mr-1.5 bg-foil border border-foil-ink" />Has an article (opens it)</span>
                        {learningNow && <span><i className="inline-block w-3.5 h-3.5 align-[-2px] mr-1.5 outline-2 outline -outline-offset-2 outline-ink" />Today</span>}
                        <span><i className="inline-block w-3.5 h-3.5 align-[-2px] mr-1.5 bg-paper-sunk" />No article yet</span>
                    </p>
                </section>
            )}

            <section aria-labelledby="articles-h" className="pt-6">
                <h2 id="articles-h" className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">Articles, in daf order</h2>
                {articles.length === 0 ? (
                    <p className="text-ink-soft py-4">No articles on {name} yet. <Link href="/articles">Browse all articles</Link>.</p>
                ) : (
                    articles.map(a => <ArticleRow key={a.id} article={a} showMasechta={false} />)
                )}
            </section>

            {stories.length > 0 && (
                <section aria-labelledby="stories-h" className="pt-8">
                    <h2 id="stories-h" className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">Stories in {name}</h2>
                    {stories.map(s => <StoryRow key={s.id} story={s} showMasechta={false} />)}
                </section>
            )}
        </div>
    )
}

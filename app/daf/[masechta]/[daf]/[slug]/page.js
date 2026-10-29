import { cache } from 'react'
import { supabase } from '@/app/lib/supabase'
import { articlePath, articleDate, formatArticleDate, dafLabel, dafPath, decodeParam, readingMinutes } from '@/app/lib/articles'
import { masechtaHref, masechtaFromParam, masechtaSlug, findMasechta, hebrewNumeral, otherSpellings } from '@/app/lib/shas'
import { buildMetadata, clip, absoluteUrl, authorJsonLd, breadcrumbJsonLd, talmudSourceJsonLd, WEBSITE_ID } from '@/app/lib/seo'
import { getStoriesForArticle, storyPath } from '@/app/lib/stories'
import { topicsFor, topicPath, subtopicsFor, subtopicPath } from '@/app/lib/topics'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Comments from '@/app/components/Comments'
import ArticleImage from '@/app/components/ArticleImage'
import ShareButtons from '@/app/components/ShareButtons'
import { Byline, AuthorStrip } from '@/app/components/Author'
import JsonLd from '@/app/components/JsonLd'
import ArticleBody from '@/app/components/ArticleBody'
import RelatedStories from '@/app/components/RelatedStories'

// Cached for an hour (saving an article in the admin refreshes it at once). The owner's
// comment delete buttons are checked in the browser, so the page needn't be rebuilt per visit.
export const revalidate = 3600

// Shared by generateMetadata and the page, so the DB is only hit once
const getArticle = cache(async (rawMasechta, rawDaf, rawSlug) => {
    const masechta = masechtaFromParam(rawMasechta)
    const slug = decodeParam(rawSlug)
    const daf = Number(rawDaf)
    if (!Number.isInteger(daf)) return null

    const { data: bySlug } = await supabase
        .from('articles')
        .select('*')
        .ilike('masechta', masechta)
        .eq('slug', slug)

    let candidates = bySlug || []

    // Rows without a slug are linked by id (see articlePath)
    if (candidates.length === 0) {
        const { data: byId } = await supabase
            .from('articles')
            .select('*')
            .ilike('masechta', masechta)
            .eq('id', slug)
        candidates = byId || []
    }

    // An article moved to another daf keeps its slug: its old address finds it here
    // (when the slug is unique) and the page redirects to the new one
    if (candidates.length === 0) {
        const { data: moved } = await supabase.from('articles').select('*').eq('slug', slug).not('masechta', 'is', null).limit(2)
        if (moved?.length === 1) return moved[0]
    }

    return candidates.find(a => a.daf === daf)
        || candidates.find(a => a.daf <= daf && (a.daf_end ?? a.daf) >= daf)
        // Moved to another daf in the same masechta: the page redirects to its new address
        || (candidates.length === 1 ? candidates[0] : null)
})

export async function generateMetadata({ params }) {
    const { masechta, daf, slug } = await params
    const article = await getArticle(masechta, daf, slug)

    if (!article) return {}

    const stories = await getStoriesForArticle(article.id, 'title, people')
    const tags = [...new Set([...topicsFor(article.tags).map(t => t.name), ...subtopicsFor(article.tags).map(s => s.name), ...stories.flatMap(s => s.people ?? [])])]

    return buildMetadata({
        title: `${article.masechta} ${dafLabel(article)}: ${article.title}`,
        // Written for Google in the author's voice; the page itself still opens with the article
        description: article.seo_description || clip(article.summary || article.content),
        path: articlePath(article),
        type: 'article',
        image: article.image_url,
        publishedTime: articleDate(article),
        modifiedTime: article.updated_at,
        tags,
        keywords: [
            `${article.masechta} ${dafLabel(article)}`,
            `Daf Yomi ${article.masechta} ${dafLabel(article)}`,
            ...otherSpellings(article.masechta).map(s => `${s} ${dafLabel(article)}`),
            ...stories.map(s => s.title),
            ...tags,
        ],
    })
}

export default async function ArticlePage({ params }) {
    const { masechta, daf, slug } = await params

    const article = await getArticle(masechta, daf, slug)

    if (!article) return notFound()

    // Reached through another daf in the article's range, or an id link: send to the canonical URL
    const canonical = articlePath(article)
    if (String(article.daf) !== daf || masechta !== masechtaSlug(article.masechta) || (article.slug && article.slug !== decodeParam(slug))) {
        permanentRedirect(canonical)
    }

    const neighbour = (op, ascending) => supabase
        .from('articles')
        .select('id, slug, title, masechta, daf, daf_end')
        .ilike('masechta', article.masechta)
        [op]('daf', article.daf)
        .order('daf', { ascending })
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

    const [stories, { data: prev }, { data: next }] = await Promise.all([
        getStoriesForArticle(article.id),
        neighbour('lt', false),
        neighbour('gt', true),
    ])

    // Google Schema
    const url = absoluteUrl(canonical)
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${url}#article`,
        url,
        mainEntityOfPage: url,
        headline: article.title,
        description: article.summary,
        image: [article.image_url || absoluteUrl('/opengraph-image')],
        author: authorJsonLd(),
        publisher: { '@id': authorJsonLd()['@id'] },
        isPartOf: { '@id': WEBSITE_ID },
        datePublished: articleDate(article),
        ...(article.updated_at && { dateModified: article.updated_at }),
        inLanguage: 'en',
        about: talmudSourceJsonLd(article.masechta, dafLabel(article)),
        keywords: [...topicsFor(article.tags), ...subtopicsFor(article.tags)].map(t => t.name).join(", "),
        articleBody: article.content,
        ...(stories.length && {
            hasPart: stories.map(s => ({
                '@type': 'Article',
                '@id': `${absoluteUrl(storyPath(s))}#story`,
                headline: s.title,
                url: absoluteUrl(storyPath(s)),
            })),
        }),
    }
    const breadcrumbs = breadcrumbJsonLd([
        { name: 'Masechtos', path: '/masechtos' },
        { name: article.masechta, path: masechtaHref(article.masechta) },
        { name: `${article.masechta} ${dafLabel(article)}`, path: dafPath(article.masechta, article.daf) },
        { name: article.title, path: canonical },
    ])

    const known = findMasechta(article.masechta)
    const end = article.daf_end ?? article.daf
    const range = end !== article.daf
    const printedIn = { jewishhome: 'The Jewish Home', '5tjt': 'the Five Towns Jewish Times', mishpacha: 'Mishpacha' }[article.source]
    const date = new Date(articleDate(article))

    return (
        <div className="folio py-5 md:py-7">
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbs} />

            {/* Running head, as at the top of a daf */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-rule mb-6">
                <nav aria-label="Breadcrumb" className="crumbs">
                    <Link href="/masechtos">Masechtos</Link>
                    <span aria-hidden="true">›</span>
                    <Link href={masechtaHref(article.masechta)}>{article.masechta}</Link>
                    <span aria-hidden="true">›</span>
                    <span aria-current="page">{dafLabel(article)}</span>
                </nav>
                {known && (
                    <span lang="he" className="text-[1.2rem]">
                        מסכת {known.hebrew} · דף {hebrewNumeral(article.daf)}{range ? `–${hebrewNumeral(end)}` : ''}
                    </span>
                )}
            </div>

            <article className="grid gap-4.5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-x-9">
                <h1 className="text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.08] md:col-start-2"><span className="hl">{article.title}</span></h1>
                {article.image_url && (
                    <div className="md:col-start-2"><ArticleImage src={article.image_url} credit={article.image_credit} alt={`${article.title}, ${article.masechta} ${dafLabel(article)}`} priority className="max-w-[50rem]" sizes="(min-width: 768px) 800px, 100vw" /></div>
                )}

                {/* The margin: folio, details, where it was printed */}
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 items-center py-2.5 border-y border-rule md:grid-cols-1 md:items-start md:content-start md:py-0 md:border-y-0 md:border-r md:pr-5 md:col-start-1 md:row-start-1 md:row-span-5 md:self-start md:sticky md:top-4">
                    <span lang="he" className="numeral sticker justify-self-start self-start text-[2.6rem] md:text-[4.2rem] row-span-2 md:row-span-1" aria-label={`Daf ${dafLabel(article)}`}>
                        {hebrewNumeral(article.daf)}{range && <span className="text-[0.45em] text-ink-soft">–{hebrewNumeral(end)}</span>}
                    </span>
                    <p className="meta leading-[1.7]">
                        {article.masechta} {dafLabel(article)}<br />
                        <time dateTime={date.toISOString()}>{formatArticleDate(article, { month: 'short', day: 'numeric', year: 'numeric' })}</time><br />
                        {article.content && <>{readingMinutes(article)} min read · </>}<a href="#discussion">Questions</a>
                    </p>
                    <div className="col-span-2 md:col-span-1"><ShareButtons url={absoluteUrl(canonical)} title={article.title} compact /></div>
                    {printedIn && (
                        <p className="note col-span-2 md:col-span-1 md:border-t md:border-rule md:pt-2.5 hidden md:block">
                            First printed in {article.source_url ? <a href={article.source_url} rel="noopener">{printedIn}</a> : printedIn}
                        </p>
                    )}
                </div>

                <div className="md:col-start-2"><Byline /></div>


                <div className="md:col-start-2">
                    <ArticleBody content={article.content} stories={stories} />
                </div>

                <div className="grid gap-8 md:col-start-2 pt-2">
                    {topicsFor(article.tags).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="sc">Topics</span>
                            {topicsFor(article.tags).map(t => (
                                <Link key={t.slug} href={topicPath(t)} className="chip">{t.name}</Link>
                            ))}
                        </div>
                    )}

                    {/* The narrower subjects it covers, each with its own page */}
                    {subtopicsFor(article.tags).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="sc">Subjects</span>
                            {subtopicsFor(article.tags).map(s => (
                                <Link key={s.slug} href={subtopicPath(s)} className="chip">{s.name}</Link>
                            ))}
                        </div>
                    )}

                    {/* Other places on the daf this article discusses (articles.refs) */}
                    {article.refs?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="sc">Also discusses</span>
                            {article.refs.map(r => (
                                <Link key={`${r.masechta}-${r.daf}`} href={dafPath(r.masechta, r.daf)} className="chip">{r.masechta} {r.daf}</Link>
                            ))}
                        </div>
                    )}

                    <ShareButtons url={absoluteUrl(canonical)} title={article.title} />

                    {(prev || next) && (
                        <nav aria-label={`More in ${article.masechta}`} className="grid md:grid-cols-2 border-y border-rule-hard">
                            {prev ? (
                                <Link href={articlePath(prev)} className="plain grid gap-0.5 py-3.5 group">
                                    <span className="meta">Previous in {article.masechta}</span>
                                    <span lang="he" className="font-[family-name:var(--font-rashi)] text-[1.25rem] text-ink-soft">{hebrewNumeral(prev.daf)}</span>
                                    <b className="font-semibold text-[1.19rem] leading-tight group-hover:underline">{prev.title}</b>
                                </Link>
                            ) : <span className="hidden md:block" />}
                            {next && (
                                <Link href={articlePath(next)} className="plain grid gap-0.5 py-3.5 group border-t border-rule md:border-t-0 md:border-l md:pl-5 md:text-right">
                                    <span className="meta">Next in {article.masechta}</span>
                                    <span lang="he" className="font-[family-name:var(--font-rashi)] text-[1.25rem] text-ink-soft">{hebrewNumeral(next.daf)}</span>
                                    <b className="font-semibold text-[1.19rem] leading-tight group-hover:underline">{next.title}</b>
                                </Link>
                            )}
                        </nav>
                    )}

                    <RelatedStories masechta={article.masechta} stories={stories} folded />

                    <Comments articleId={article.id} />

                    <AuthorStrip />
                </div>
            </article>
        </div>
    )
}

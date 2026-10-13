import { cache } from 'react'
import { supabase } from '@/app/lib/supabase'
import { isAdmin } from '@/app/lib/adminAuth'
import { BEYOND_THE_DAF, BEYOND_THE_DAF_PATH, articlePath, articleDate, formatArticleDate, decodeParam, isStandalone, readingMinutes } from '@/app/lib/articles'
import { buildMetadata, clip, absoluteUrl, authorJsonLd, breadcrumbJsonLd, WEBSITE_ID } from '@/app/lib/seo'
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

export const revalidate = 0

// A standalone article (tribute, Q&A, magazine piece): one with no masechta/daf.
// Shared by generateMetadata and the page, so the DB is only hit once.
const getArticle = cache(async rawSlug => {
    const slug = decodeParam(rawSlug)

    const { data: bySlug } = await supabase
        .from('articles')
        .select('*')
        .is('masechta', null)
        .eq('slug', slug)
        .limit(1)

    if (bySlug?.[0]) return bySlug[0]

    // Rows without a slug are linked by id (see articlePath)
    const { data: byId } = await supabase
        .from('articles')
        .select('*')
        .is('masechta', null)
        .eq('id', slug)
        .limit(1)

    return byId?.[0] ?? null
})

export async function generateMetadata({ params }) {
    const { slug } = await params
    const article = await getArticle(slug)

    if (!article) return {}

    const stories = await getStoriesForArticle(article.id, 'title, people')
    const tags = [...new Set([...topicsFor(article.tags).map(t => t.name), ...subtopicsFor(article.tags).map(s => s.name), ...stories.flatMap(s => s.people ?? [])])]

    return buildMetadata({
        title: article.title,
        description: clip(article.summary || article.content),
        path: articlePath(article),
        type: 'article',
        image: article.image_url,
        publishedTime: articleDate(article),
        modifiedTime: article.updated_at,
        tags,
        keywords: [
            'Rabbi Avrohom Sebrow',
            ...stories.map(s => s.title),
            ...tags,
        ],
    })
}

export default async function BeyondTheDafArticlePage({ params }) {
    const { slug } = await params

    const article = await getArticle(slug)

    if (!article || !isStandalone(article)) return notFound()

    // An id link to an article that has a slug: send to the canonical URL
    const canonical = articlePath(article)
    if (article.slug && article.slug !== decodeParam(slug)) {
        permanentRedirect(canonical)
    }

    const [admin, stories] = await Promise.all([
        isAdmin(),
        getStoriesForArticle(article.id),
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
        { name: BEYOND_THE_DAF, path: BEYOND_THE_DAF_PATH },
        { name: article.title, path: canonical },
    ])

    const printedIn = { jewishhome: 'The Jewish Home', '5tjt': 'the Five Towns Jewish Times', mishpacha: 'Mishpacha' }[article.source]
    const date = new Date(articleDate(article))

    return (
        <div className="folio py-5 md:py-7">
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbs} />

            {/* Running head */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-rule mb-6">
                <nav aria-label="Breadcrumb" className="crumbs">
                    <Link href={BEYOND_THE_DAF_PATH}>{BEYOND_THE_DAF}</Link>
                    <span aria-hidden="true">›</span>
                    <span aria-current="page">{article.title}</span>
                </nav>
            </div>

            <article className="grid gap-4.5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-x-9">
                <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em] md:col-start-2">{article.title}</h1>
                {article.image_url && (
                    <div className="md:col-start-2"><ArticleImage src={article.image_url} alt="" priority className="max-w-[38rem]" sizes="(min-width: 768px) 608px, 100vw" /></div>
                )}

                {/* The margin: details, where it was printed */}
                <div className="grid grid-cols-1 gap-y-2 items-center py-2.5 border-y border-rule md:items-start md:content-start md:py-0 md:border-y-0 md:border-r md:pr-5 md:col-start-1 md:row-start-1 md:row-span-5 md:self-start md:sticky md:top-4">
                    <p className="meta leading-[1.7]">
                        <Link href={BEYOND_THE_DAF_PATH}>{BEYOND_THE_DAF}</Link><br />
                        <time dateTime={date.toISOString()}>{formatArticleDate(article, { month: 'short', day: 'numeric', year: 'numeric' })}</time><br />
                        {article.content && <>{readingMinutes(article)} min read · </>}<a href="#discussion">Questions</a>
                    </p>
                    <div><ShareButtons url={absoluteUrl(canonical)} title={article.title} compact /></div>
                    {printedIn && (
                        <p className="note md:border-t md:border-rule md:pt-2.5 hidden md:block">
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

                    <ShareButtons url={absoluteUrl(canonical)} title={article.title} />

                    <RelatedStories masechta={null} stories={stories} />

                    <Comments articleId={article.id} isAdmin={admin} />

                    <AuthorStrip />
                </div>
            </article>
        </div>
    )
}

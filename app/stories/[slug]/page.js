import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { articlePath, articleDate, articlePlace, dafPath, decodeParam, readingMinutes, slugify, BEYOND_THE_DAF, BEYOND_THE_DAF_PATH } from '@/app/lib/articles'
import { masechtaHref, findMasechta, hebrewNumeral } from '@/app/lib/shas'
import { buildMetadata, clip, absoluteUrl, authorJsonLd, breadcrumbJsonLd, talmudSourceJsonLd, WEBSITE_ID } from '@/app/lib/seo'
import { getStoryBySlug, storyPath, personPath } from '@/app/lib/stories'
import { topicsFor, topicPath } from '@/app/lib/topics'
import JsonLd from '@/app/components/JsonLd'
import RelatedStories from '@/app/components/RelatedStories'
import ArticleBody, { locate, paragraphs } from '@/app/components/ArticleBody'

export const revalidate = 3600

// Shared by generateMetadata and the page, so the DB is only hit once
const getStoryWithArticle = cache(async (rawSlug) => {
    const story = await getStoryBySlug(decodeParam(rawSlug))
    if (!story) return null

    const { data: article } = story.article_id
        ? await supabase
            .from('articles')
            .select('id, slug, title, masechta, daf, daf_end, published_at, created_at, content')
            .eq('id', story.article_id)
            .maybeSingle()
        : { data: null }

    return { story, article }
})

// The story as it sits in the article: the paragraphs it spans, with the story lit up
// and any of the article's own words around it shown faded. Null if the article was
// edited and the story can no longer be found in it.
function clipping(story, article) {
    const content = article?.content
    if (!content) return null
    const at = locate(content, story)
    if (!at) return null
    const spans = paragraphs(content).filter(([s, e]) => e > at.start && s < at.end)
    if (!spans.length) return null
    const from = spans[0][0], to = spans.at(-1)[1]
    return {
        content: content.slice(from, to),
        story: { ...story, start_offset: at.start - from, end_offset: at.end - from },
    }
}

function storyTitle(story) {
    if (!story.masechta) return `${story.title} – ${BEYOND_THE_DAF}`
    return `${story.title} – ${story.masechta} ${story.daf} Gemara Story`
}

export async function generateMetadata({ params }) {
    const found = await getStoryWithArticle((await params).slug)
    if (!found) return {}
    const { story, article } = found

    return buildMetadata({
        title: storyTitle(story),
        description: clip(story.summary || story.content),
        path: storyPath(story),
        type: 'article',
        image: `${storyPath(story)}/opengraph-image`, // this segment's generated card
        publishedTime: article ? articleDate(article) : story.created_at,
        modifiedTime: story.updated_at,
        tags: [...(story.people ?? []), ...topicsFor(story.tags).map(t => t.name)],
        keywords: [
            story.title,
            ...(story.masechta ? [
                `${story.title} Gemara`,
                `${story.masechta} ${story.daf}`,
                `${story.masechta} ${story.daf} story`,
                'Gemara story',
                'Daf Yomi story',
            ] : []),
            ...(story.people ?? []).map(p => `${p} story`),
            ...topicsFor(story.tags).map(t => t.name),
        ],
    })
}

export default async function StoryPage({ params }) {
    const found = await getStoryWithArticle((await params).slug)
    if (!found) return notFound()
    const { story, article } = found

    const path = storyPath(story)
    const url = absoluteUrl(path)
    const articleUrl = article ? absoluteUrl(articlePath(article)) : null

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${url}#story`,
        url,
        mainEntityOfPage: url,
        headline: story.title,
        alternativeHeadline: storyTitle(story),
        description: story.summary,
        image: [absoluteUrl(`${path}/opengraph-image`)],
        author: authorJsonLd(),
        publisher: { '@id': authorJsonLd()['@id'] },
        datePublished: article ? articleDate(article) : story.created_at,
        dateModified: story.updated_at,
        inLanguage: 'en',
        ...(story.masechta && { genre: 'Aggadah' }),
        keywords: [...(story.people ?? []), ...topicsFor(story.tags).map(t => t.name)].join(', '),
        about: [
            ...(story.masechta ? [talmudSourceJsonLd(story.masechta, story.daf)] : []),
            ...(story.people ?? []).map(name => ({ '@type': 'Person', name })),
        ],
        isPartOf: articleUrl ? { '@type': 'Article', '@id': `${articleUrl}#article`, url: articleUrl, headline: article.title } : { '@id': WEBSITE_ID },
        articleBody: story.content,
    }
    const breadcrumbs = breadcrumbJsonLd(story.masechta ? [
        { name: 'Masechtos', path: '/masechtos' },
        { name: story.masechta, path: masechtaHref(story.masechta) },
        { name: `${story.masechta} ${story.daf}`, path: dafPath(story.masechta, story.daf) },
        { name: story.title, path },
    ] : [
        { name: BEYOND_THE_DAF, path: BEYOND_THE_DAF_PATH },
        ...(article ? [{ name: article.title, path: articlePath(article) }] : []),
        { name: story.title, path },
    ])

    const known = findMasechta(story.masechta)
    const clipped = clipping(story, article)
    const backToArticle = article ? `${articlePath(article)}#${encodeURIComponent(story.slug)}` : null
    const topics = topicsFor(story.tags)

    // Laid out as a clipping of the article, not an article of its own: where it comes
    // from, the story lit up in its place, and one clear way into the whole article.
    return (
        <div className="folio py-5 md:py-7">
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbs} />

            <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-rule mb-6">
                <nav aria-label="Breadcrumb" className="crumbs">
                    <Link href="/stories">Stories</Link>
                    <span aria-hidden="true">›</span>
                    <Link href={`/stories#${slugify(story.masechta || BEYOND_THE_DAF)}`}>{story.masechta || BEYOND_THE_DAF}</Link>
                </nav>
                {known && <span lang="he" className="text-[1.2rem]">{known.hebrew} · דף {hebrewNumeral(story.daf)}</span>}
            </div>

            <article className="grid gap-5 max-w-[46rem]">
                {article && (
                    <p className="meta">
                        A story from the article <Link href={articlePath(article)} className="font-semibold">{article.title}</Link>
                        <span aria-hidden="true"> · </span>{articlePlace(article)}
                    </p>
                )}
                <h1 className="font-semibold text-[clamp(2rem,4.5vw,3rem)] leading-[1.04] tracking-[-0.02em]">{story.title}</h1>
                {story.summary && <p className="text-lede text-ink-soft max-w-[54ch]">{story.summary}</p>}

                <div className="story-clip">
                    {clipped
                        ? <ArticleBody content={clipped.content} stories={[clipped.story]} />
                        : <ArticleBody content={story.content} />}
                </div>

                {article && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link href={backToArticle} className="btn">Read the whole article</Link>
                        {article.content && <span className="meta">{readingMinutes(article)} min read · the story is highlighted</span>}
                    </div>
                )}

                {(story.people?.length > 0 || topics.length > 0) && (
                    <div className="grid gap-1 border-t border-rule pt-3">
                        {story.people?.length > 0 && (
                            <p className="meta">
                                {story.people.length === 1 ? 'Sage' : 'Sages'}: {story.people.map((name, i) => <span key={name}>{i > 0 && ', '}<Link href={personPath(name)}>{name}</Link></span>)}
                            </p>
                        )}
                        {topics.length > 0 && (
                            <p className="meta">
                                Topics: {topics.map((t, i) => <span key={t.slug}>{i > 0 && ', '}<Link href={topicPath(t)}>{t.name}</Link></span>)}
                            </p>
                        )}
                    </div>
                )}

                <RelatedStories masechta={story.masechta} stories={[story]} showOwn={false} folded />
            </article>
        </div>
    )
}

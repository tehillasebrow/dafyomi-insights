import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { articlePath, articleDate, articlePlace, dafPath, decodeParam, readingMinutes, slugify, BEYOND_THE_DAF, BEYOND_THE_DAF_PATH } from '@/app/lib/articles'
import { masechtaHref, findMasechta, hebrewNumeral } from '@/app/lib/shas'
import { buildMetadata, clip, absoluteUrl, authorJsonLd, breadcrumbJsonLd, talmudSourceJsonLd, WEBSITE_ID } from '@/app/lib/seo'
import { getStoryBySlug, getStoriesForArticle, storyPath, personPath } from '@/app/lib/stories'
import { topicsFor, topicPath } from '@/app/lib/topics'
import JsonLd from '@/app/components/JsonLd'
import RelatedStories from '@/app/components/RelatedStories'
import ArticleBody from '@/app/components/ArticleBody'
import ShareButtons from '@/app/components/ShareButtons'
import { Byline } from '@/app/components/Author'

export const revalidate = 3600

// Shared by generateMetadata and the page, so the DB is only hit once
const getStoryWithArticle = cache(async (rawSlug) => {
    const story = await getStoryBySlug(decodeParam(rawSlug))
    if (!story) return null

    const { data: article } = story.article_id
        ? await supabase
            .from('articles')
            .select('id, slug, title, masechta, daf, daf_end, published_at, created_at')
            .eq('id', story.article_id)
            .maybeSingle()
        : { data: null }

    return { story, article }
})

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

    // Previous / next story in the same article
    const siblings = article ? await getStoriesForArticle(article.id, 'id, slug, title, position') : []
    const index = siblings.findIndex(s => s.id === story.id)
    const prev = index > 0 ? siblings[index - 1] : null
    const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

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

            <article className="grid gap-4.5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-x-9">
                <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em] md:col-start-2">{story.title}</h1>
                {story.summary && <p className="text-lede text-ink-soft max-w-[54ch] md:col-start-2">{story.summary}</p>}

                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 items-center py-2.5 border-y border-rule md:grid-cols-1 md:items-start md:content-start md:py-0 md:border-y-0 md:border-r md:pr-5 md:col-start-1 md:row-start-1 md:row-span-4 md:self-start md:sticky md:top-4">
                    {story.masechta && <span lang="he" className="numeral text-[3.25rem] md:text-[5rem] leading-[0.85]" aria-label={`Daf ${story.daf}`}>{hebrewNumeral(story.daf)}</span>}
                    <p className={`meta leading-[1.7] ${story.masechta ? '' : 'col-span-2 md:col-span-1'}`}>{story.masechta ? `${story.masechta} ${story.daf}` : BEYOND_THE_DAF}{story.content && <><br />{readingMinutes(story)} min read</>}</p>
                    {story.people?.length > 0 && (
                        <div className="col-span-2 md:col-span-1 md:border-t md:border-rule md:pt-2.5">
                            <span className="sc">{story.people.length === 1 ? 'Sage' : 'Sages'}</span>
                            <ul>{story.people.map(name => <li key={name}><Link href={personPath(name)} className="min-h-10 inline-flex items-center">{name}</Link></li>)}</ul>
                        </div>
                    )}
                    {article && (
                        <div className="col-span-2 md:col-span-1 md:border-t md:border-rule md:pt-2.5">
                            <span className="sc">From the article</span>
                            <p><Link href={`${articlePath(article)}#${encodeURIComponent(story.slug)}`}>{article.title}</Link></p>
                            <p className="meta">{articlePlace(article)}</p>
                        </div>
                    )}
                </div>

                <div className="md:col-start-2"><Byline /></div>

                <div className="md:col-start-2"><ArticleBody content={story.content} /></div>

                <div className="grid gap-8 md:col-start-2 pt-2">
                    {topicsFor(story.tags).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="sc">Topics</span>
                            {topicsFor(story.tags).map(t => <Link key={t.slug} href={topicPath(t)} className="chip">{t.name}</Link>)}
                        </div>
                    )}

                    <ShareButtons url={url} title={story.title} />

                    {(prev || next) && (
                        <nav aria-label="More stories from this article" className="grid md:grid-cols-2 border-y border-rule-hard">
                            {prev ? (
                                <Link href={storyPath(prev)} className="plain grid gap-0.5 py-3.5 group">
                                    <span className="meta">Previous story in this article</span>
                                    <b className="font-semibold text-[1.19rem] leading-tight group-hover:underline">{prev.title}</b>
                                </Link>
                            ) : <span className="hidden md:block" />}
                            {next && (
                                <Link href={storyPath(next)} className="plain grid gap-0.5 py-3.5 group border-t border-rule md:border-t-0 md:border-l md:pl-5 md:text-right">
                                    <span className="meta">Next story in this article</span>
                                    <b className="font-semibold text-[1.19rem] leading-tight group-hover:underline">{next.title}</b>
                                </Link>
                            )}
                        </nav>
                    )}

                    <RelatedStories masechta={story.masechta} stories={[story]} showOwn={false} />

                    {article && (
                        <p className="meta">Questions about this story? <Link href={`${articlePath(article)}#discussion`}>Ask in the article’s discussion</Link>.</p>
                    )}
                </div>
            </article>
        </div>
    )
}

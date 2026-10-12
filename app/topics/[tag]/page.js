import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { ARTICLE_LIST_COLUMNS, orderByPublished, decodeParam } from '@/app/lib/articles'
import { findMasechta, masechtaHref } from '@/app/lib/shas'
import { buildMetadata, breadcrumbJsonLd } from '@/app/lib/seo'
import { getStoriesWithTag } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import ArticleRow from '@/app/components/ArticleRow'
import StoryRow from '@/app/components/StoryRow'

export const revalidate = 3600

export async function generateMetadata({ params }) {
    const { tag } = await params
    const decodedTag = decodeParam(tag)
    return buildMetadata({
        title: `${decodedTag} in the Gemara – Daf Yomi Articles & Stories`,
        description: `Daf Yomi articles, Gemara stories and insights on ${decodedTag}, by Rabbi Avrohom Sebrow.`,
        path: `/topics/${encodeURIComponent(decodedTag)}`,
        keywords: [`${decodedTag} Gemara`, `${decodedTag} Talmud`, `${decodedTag} Daf Yomi`],
    })
}

export default async function SingleTopicPage({ params }) {
    const { tag } = await params
    const decodedTag = decodeParam(tag)

    const [{ data }, stories] = await Promise.all([
        orderByPublished(supabase.from('articles').select(ARTICLE_LIST_COLUMNS).contains('tags', [decodedTag])),
        getStoriesWithTag(decodedTag),
    ])
    const articles = data ?? []
    const masechtos = [...new Set([...articles, ...stories].map(x => findMasechta(x.masechta)?.name).filter(Boolean))]

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={breadcrumbJsonLd([{ name: 'Topics', path: '/topics' }, { name: decodedTag, path: `/topics/${encodeURIComponent(decodedTag)}` }])} />
            <nav aria-label="Breadcrumb" className="crumbs"><Link href="/topics">Topics</Link></nav>

            <header className="grid gap-1.5 pb-4 border-b border-rule-hard">
                <p className="sc">Topic</p>
                <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">{decodedTag}</h1>
                <p className="meta">
                    {articles.length} {articles.length === 1 ? 'article' : 'articles'}
                    {stories.length > 0 && `, ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`}
                    {masechtos.length > 0 && <>, in {masechtos.map((m, i) => <span key={m}>{i > 0 && (i === masechtos.length - 1 ? ' and ' : ', ')}<Link href={masechtaHref(m)}>{m}</Link></span>)}</>}
                </p>
            </header>

            {articles.length === 0 && stories.length === 0 && (
                <p className="text-ink-soft py-4">Nothing is filed under “{decodedTag}” yet. <Link href="/topics">See all topics</Link>.</p>
            )}

            {articles.map(a => <ArticleRow key={a.id} article={a} />)}

            {stories.length > 0 && (
                <section aria-labelledby="stories-h" className="pt-8">
                    <h2 id="stories-h" className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">Gemara stories on {decodedTag}</h2>
                    {stories.map(s => <StoryRow key={s.id} story={s} />)}
                </section>
            )}
        </div>
    )
}

import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { ARTICLE_LIST_COLUMNS, orderByPublished, decodeParam, articlePath } from '@/app/lib/articles'
import { findMasechta, masechtaHref } from '@/app/lib/shas'
import { buildMetadata, breadcrumbJsonLd, collectionJsonLd } from '@/app/lib/seo'
import { findTopic, findSubtopic, topicPath, subtopicPath, subtopicVariants } from '@/app/lib/topics'
import { STORY_CARD_COLUMNS, storyPath } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import ArticleRow from '@/app/components/ArticleRow'
import StoryRow from '@/app/components/StoryRow'

export const revalidate = 3600

// /topics/{topic}/{subtopic}: one narrow subject ("Presidential Autopen"), so a
// search for exactly that lands on the articles about it
function resolve(params) {
    const topic = findTopic(decodeParam(params.tag))
    const sub = findSubtopic(decodeParam(params.sub))
    return { topic, sub }
}

export async function generateMetadata({ params }) {
    const { sub } = resolve(await params)
    if (!sub) return {}
    const { count } = await supabase.from('articles').select('id', { count: 'exact', head: true }).overlaps('tags', subtopicVariants(sub))
    const meta = buildMetadata({
        title: `${sub.name} – ${sub.topic.name} in the Gemara`,
        description: `${sub.description} Daf Yomi articles by Rabbi Avrohom Sebrow.`,
        path: subtopicPath(sub),
        keywords: [sub.name, `${sub.name} halacha`, `${sub.name} Gemara`, sub.topic.name, ...(sub.aliases ?? []).slice(0, 4)],
    })
    return count ? meta : { ...meta, robots: { index: false, follow: true } }
}

export default async function SubtopicPage({ params }) {
    const p = await params
    const { topic, sub } = resolve(p)
    if (!sub) return topic ? permanentRedirect(topicPath(topic)) : notFound()
    // Wrong parent, old spelling or alias: go to the one address for this subtopic
    if (topic?.slug !== sub.topic.slug || decodeParam(p.sub) !== sub.slug) permanentRedirect(subtopicPath(sub))

    const variants = subtopicVariants(sub)
    const [{ data }, { data: storyData }] = await Promise.all([
        orderByPublished(supabase.from('articles').select(ARTICLE_LIST_COLUMNS).overlaps('tags', variants)),
        supabase.from('stories').select(STORY_CARD_COLUMNS).overlaps('tags', variants).order('masechta').order('daf'),
    ])
    const articles = data ?? []
    const stories = storyData ?? []
    const masechtos = [...new Set([...articles, ...stories].map(x => findMasechta(x.masechta)?.name).filter(Boolean))]
    const siblings = sub.topic.subtopics.filter(s => s.slug !== sub.slug)
    const path = subtopicPath(sub)

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={breadcrumbJsonLd([{ name: 'Topics', path: '/topics' }, { name: sub.topic.name, path: topicPath(sub.topic) }, { name: sub.name, path }])} />
            <JsonLd data={collectionJsonLd({
                name: sub.name,
                description: sub.description,
                path,
                items: [
                    ...articles.map(a => ({ name: a.title, path: articlePath(a) })),
                    ...stories.map(s => ({ name: s.title, path: storyPath(s) })),
                ],
            })} />
            <nav aria-label="Breadcrumb" className="crumbs">
                <Link href="/topics">Topics</Link>
                <span aria-hidden="true">›</span>
                <Link href={topicPath(sub.topic)}>{sub.topic.name}</Link>
            </nav>

            <header className="grid gap-1.5 pb-4 border-b border-rule-hard">
                <p className="sc">{sub.topic.name}</p>
                <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">{sub.name}</h1>
                <p className="text-lede text-ink-soft max-w-[62ch]">{sub.description}</p>
                <p className="meta">
                    {articles.length} {articles.length === 1 ? 'article' : 'articles'}
                    {stories.length > 0 && `, ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`}
                    {masechtos.length > 0 && <>, in {masechtos.map((m, i) => <span key={m}>{i > 0 && (i === masechtos.length - 1 ? ' and ' : ', ')}<Link href={masechtaHref(m)}>{m}</Link></span>)}</>}
                </p>
            </header>

            {articles.length === 0 && stories.length === 0 && (
                <p className="text-ink-soft py-4">Nothing is filed under “{sub.name}” yet. <Link href={topicPath(sub.topic)}>See everything on {sub.topic.name}</Link>.</p>
            )}

            {articles.map(a => <ArticleRow key={a.id} article={a} />)}

            {stories.length > 0 && (
                <section aria-labelledby="stories-h" className="pt-8">
                    <h2 id="stories-h" className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">Gemara stories</h2>
                    {stories.map(s => <StoryRow key={s.id} story={s} />)}
                </section>
            )}

            <nav aria-label={`More on ${sub.topic.name}`} className="pt-8">
                <p className="sc pb-2">More on {sub.topic.name}</p>
                <p className="flex flex-wrap gap-2">
                    <Link href={topicPath(sub.topic)} className="chip">All of {sub.topic.name}</Link>
                    {siblings.map(s => <Link key={s.slug} href={subtopicPath(s)} className="chip">{s.name}</Link>)}
                </p>
            </nav>
        </div>
    )
}

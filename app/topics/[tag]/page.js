import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { ARTICLE_LIST_COLUMNS, orderByPublished, decodeParam, articlePath } from '@/app/lib/articles'
import { findMasechta, masechtaHref } from '@/app/lib/shas'
import { buildMetadata, breadcrumbJsonLd, collectionJsonLd } from '@/app/lib/seo'
import { findTopic, isRetiredTag, topicPath, tagVariants, TOPICS, subtopicsFor, subtopicPath, topicHeading, topicIntro } from '@/app/lib/topics'
import { STORY_CARD_COLUMNS, storyPath } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import ArticleRow from '@/app/components/ArticleRow'
import StoryRow from '@/app/components/StoryRow'

export const revalidate = 3600

// "Rabbi Sebrow explores [the manna](/daf/yoma/76/...)" -> text with a link
function withLinks(text) {
    return text.split(/(\[[^\]]+\]\([^)\s]+\))/).map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
        return m ? <Link key={i} href={m[2]}>{m[1]}</Link> : part
    })
}

export async function generateMetadata({ params }) {
    const topic = findTopic(decodeParam((await params).tag))
    if (!topic) return {}
    // A topic with nothing filed under it yet stays out of Google until it has content
    const { count } = await supabase.from('articles').select('id', { count: 'exact', head: true }).overlaps('tags', tagVariants(topic))
    const meta = buildMetadata({
        title: `${topicHeading(topic)} – Daf Yomi Articles & Stories`,
        description: topicIntro(topic)?.description ?? `${topic.description} Daf Yomi articles and Gemara stories by Rabbi Avrohom Sebrow.`,
        path: topicPath(topic),
        keywords: [topic.name, `${topic.name} Gemara`, `${topic.name} Talmud`, `${topic.name} Daf Yomi`, ...(topic.aliases ?? []).filter(a => a.split(' ').length <= 3).slice(0, 6)],
    })
    return count ? meta : { ...meta, robots: { index: false, follow: true } }
}

export default async function SingleTopicPage({ params }) {
    const raw = decodeParam((await params).tag)
    const topic = findTopic(raw)
    // Old tag URLs (/topics/Ketubah, /topics/Magen%20Avraham%20147:5) go to the topic, or to all topics
    if (!topic) return isRetiredTag(raw) ? permanentRedirect('/topics') : notFound()
    if (raw !== topic.slug) permanentRedirect(topicPath(topic))

    // Every stored spelling of the topic, so articles tagged before the clean-up still show
    const variants = tagVariants(topic)
    const [{ data }, { data: storyData }] = await Promise.all([
        orderByPublished(supabase.from('articles').select(ARTICLE_LIST_COLUMNS).overlaps('tags', variants)),
        supabase.from('stories').select(STORY_CARD_COLUMNS).overlaps('tags', variants).order('masechta').order('daf'),
    ])
    const articles = data ?? []
    const stories = storyData ?? []
    const masechtos = [...new Set([...articles, ...stories].map(x => findMasechta(x.masechta)?.name).filter(Boolean))]
    const related = TOPICS.filter(t => t.group === topic.group && t.slug !== topic.slug)
    // This topic's subtopics that have something filed under them, most used first
    const subCounts = new Map()
    for (const row of [...articles, ...stories]) {
        for (const s of subtopicsFor(row.tags)) if (s.topic.slug === topic.slug) subCounts.set(s, (subCounts.get(s) ?? 0) + 1)
    }
    const subtopics = [...subCounts].sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name))
    const path = topicPath(topic)
    const intro = topicIntro(topic)

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={breadcrumbJsonLd([{ name: 'Topics', path: '/topics' }, { name: topic.name, path }])} />
            <JsonLd data={collectionJsonLd({
                name: topicHeading(topic),
                description: topic.description,
                path,
                items: [
                    ...articles.map(a => ({ name: a.title, path: articlePath(a) })),
                    ...stories.map(s => ({ name: s.title, path: storyPath(s) })),
                ],
            })} />
            <nav aria-label="Breadcrumb" className="crumbs"><Link href="/topics">Topics</Link></nav>

            <header className="grid gap-1.5 pb-4 border-b border-rule-hard">
                <p className="sc">{topic.group}</p>
                <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">{topicHeading(topic)}</h1>
                <p className="text-lede text-ink-soft max-w-[62ch]">{topic.description}</p>
                {intro && (
                    <div className="grid gap-3 max-w-[62ch] pt-2">
                        {intro.intro.split(/\n\s*\n/).map((para, i) => <p key={i}>{withLinks(para)}</p>)}
                    </div>
                )}
                <p className="meta">
                    {articles.length} {articles.length === 1 ? 'article' : 'articles'}
                    {stories.length > 0 && `, ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`}
                    {masechtos.length > 0 && <>, in {masechtos.map((m, i) => <span key={m}>{i > 0 && (i === masechtos.length - 1 ? ' and ' : ', ')}<Link href={masechtaHref(m)}>{m}</Link></span>)}</>}
                </p>
            </header>

            {subtopics.length > 0 && (
                <nav aria-label={`Subjects within ${topic.name}`} className="py-4 border-b border-rule">
                    <p className="sc pb-2">Subjects within {topic.name}</p>
                    <p className="flex flex-wrap gap-2">
                        {subtopics.map(([s, n]) => (
                            <Link key={s.slug} href={subtopicPath(s)} className="chip">{s.name}{n > 1 && <span className="text-ink-soft"> · {n}</span>}</Link>
                        ))}
                    </p>
                </nav>
            )}

            {articles.length === 0 && stories.length === 0 && (
                <p className="text-ink-soft py-4">Nothing is filed under “{topic.name}” yet. <Link href="/topics">See all topics</Link>.</p>
            )}

            {articles.map(a => <ArticleRow key={a.id} article={a} />)}

            {stories.length > 0 && (
                <section aria-labelledby="stories-h" className="pt-8">
                    <h2 id="stories-h" className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">Gemara stories on {topic.name}</h2>
                    {stories.map(s => <StoryRow key={s.id} story={s} />)}
                </section>
            )}

            {related.length > 0 && (
                <nav aria-label={`More in ${topic.group}`} className="pt-8">
                    <p className="sc pb-2">More in {topic.group}</p>
                    <p className="flex flex-wrap gap-2">
                        {related.map(t => <Link key={t.slug} href={topicPath(t)} className="chip">{t.name}</Link>)}
                    </p>
                </nav>
            )}
        </div>
    )
}

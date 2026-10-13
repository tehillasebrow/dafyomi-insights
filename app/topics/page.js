import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { buildMetadata, collectionJsonLd } from '@/app/lib/seo'
import { TOPICS, TOPIC_GROUPS, countTopics, topicPath } from '@/app/lib/topics'
import { slugify } from '@/app/lib/articles'
import JsonLd from '@/app/components/JsonLd'

export const revalidate = 3600

const DESCRIPTION = 'Browse Daf Yomi articles and Gemara stories by topic: Shabbos and Yom Tov, tefillah and berachos, kashrus, marriage, business halacha, mussar and more.'

export const metadata = buildMetadata({
    title: 'Daf Yomi Topics – Articles & Gemara Stories by Subject',
    description: DESCRIPTION,
    path: '/topics',
})

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export default async function TopicsPage() {
    const [{ data: articles }, { data: stories }] = await Promise.all([
        supabase.from('articles').select('tags'),
        supabase.from('stories').select('tags'),
    ])
    const articleCounts = countTopics(articles)
    const storyCounts = countTopics(stories)

    // Only topics with something filed under them, grouped like data/topics.json
    const groups = TOPIC_GROUPS
        .map(group => ({
            group,
            topics: TOPICS
                .filter(t => t.group === group && (articleCounts.get(t.slug) || storyCounts.get(t.slug)))
                .map(t => ({
                    ...t,
                    note: [
                        articleCounts.get(t.slug) && plural(articleCounts.get(t.slug), 'article', 'articles'),
                        storyCounts.get(t.slug) && plural(storyCounts.get(t.slug), 'story', 'stories'),
                    ].filter(Boolean).join(' · '),
                })),
        }))
        .filter(g => g.topics.length)

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={collectionJsonLd({
                name: 'Daf Yomi Topics',
                description: DESCRIPTION,
                path: '/topics',
                items: groups.flatMap(g => g.topics.map(t => ({ name: t.name, path: topicPath(t) }))),
            })} />

            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Topics</h1>
                <p className="text-lede text-ink-soft max-w-[58ch]">Every subject the articles and stories touch on, filed by area.</p>
            </header>

            {groups.length === 0 ? (
                <p className="text-ink-soft py-4">Topics appear here as articles are tagged.</p>
            ) : (
                <>
                    <nav aria-label="Topic areas" className="flex flex-wrap gap-x-4 gap-y-1 py-3.5 border-b border-rule">
                        {groups.map(g => <a key={g.group} href={`#${slugify(g.group)}`} className="tap">{g.group}</a>)}
                    </nav>
                    {groups.map(g => (
                        <section key={g.group} id={slugify(g.group)} aria-labelledby={`${slugify(g.group)}-h`} className="pt-7 scroll-mt-24">
                            <h2 id={`${slugify(g.group)}-h`} className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">{g.group}</h2>
                            <ul className="grid md:grid-cols-2 md:gap-x-8">
                                {g.topics.map(t => (
                                    <li key={t.slug} className="border-b border-rule py-2.5">
                                        <Link href={topicPath(t)} className="font-semibold">{t.name}</Link>
                                        <span className="meta block">{t.note}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </>
            )}
        </div>
    )
}

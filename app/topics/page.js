import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { buildMetadata, collectionJsonLd } from '@/app/lib/seo'
import { TOPICS, TOPIC_GROUPS, countTopics, topicPath, subtopicsFor, subtopicPath } from '@/app/lib/topics'
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
    // Each topic's subjects that have something filed under them, most used first
    const subCounts = new Map()
    for (const row of [...(articles ?? []), ...(stories ?? [])]) {
        for (const s of subtopicsFor(row.tags)) subCounts.set(s, (subCounts.get(s) ?? 0) + 1)
    }
    const subjectsOf = t => t.subtopics
        .filter(s => subCounts.has(s))
        .sort((a, b) => subCounts.get(b) - subCounts.get(a) || a.name.localeCompare(b.name))
    const SHOWN = 4

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
            </header>

            {groups.length === 0 ? (
                <p className="text-ink-soft py-4">Topics appear here as articles are tagged.</p>
            ) : (
                <>
                    <nav aria-label="Topic areas" className="flex flex-wrap gap-2 py-4 border-b border-rule max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:whitespace-nowrap">
                        {groups.map(g => <a key={g.group} href={`#${slugify(g.group)}`} className="chip bg-surface hover:bg-mark">{g.group}</a>)}
                    </nav>
                    {groups.map(g => (
                        <section key={g.group} id={slugify(g.group)} aria-labelledby={`${slugify(g.group)}-h`} className="pt-7 scroll-mt-24">
                            <h2 id={`${slugify(g.group)}-h`} className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">{g.group}</h2>
                            <ul className="grid gap-3.5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                                {g.topics.map(t => {
                                    const subjects = subjectsOf(t)
                                    return (
                                        <li key={t.slug} className="index-card p-5 grid gap-2.5 content-start min-w-0">
                                            <div className="grid gap-0.5">
                                                <Link href={topicPath(t)} className="topic-name">{t.name}</Link>
                                                <span className="meta">{t.note}</span>
                                            </div>
                                            {subjects.length > 0 && (
                                                <ul className="topic-subs">
                                                    {subjects.slice(0, SHOWN).map(s => <li key={s.slug}><Link href={subtopicPath(s)}>{s.name}</Link></li>)}
                                                </ul>
                                            )}
                                            {subjects.length > SHOWN && <Link href={topicPath(t)} className="kicker no-underline hover:underline">All {subjects.length} subjects →</Link>}
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ))}
                </>
            )}
        </div>
    )
}

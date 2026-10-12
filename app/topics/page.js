import { supabase } from '@/app/lib/supabase'
import { buildMetadata } from '@/app/lib/seo'
import AlphaIndex from '@/app/components/AlphaIndex'

export const revalidate = 3600

export const metadata = buildMetadata({
    title: 'Daf Yomi Topics – Articles & Gemara Stories by Subject',
    description: 'Browse Daf Yomi articles and Gemara stories by topic, from halacha to aggadah.',
    path: '/topics',
})

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export default async function TopicsPage() {
    const [{ data: articles }, { data: stories }] = await Promise.all([
        supabase.from('articles').select('tags'),
        supabase.from('stories').select('tags'),
    ])

    // One index for both: "Bechor · 6 articles · 2 stories"
    const counts = new Map()
    const add = (rows, field) => {
        for (const row of rows ?? []) {
            for (const raw of row.tags ?? []) {
                const tag = raw?.trim()
                if (!tag) continue
                const c = counts.get(tag) ?? { articles: 0, stories: 0 }
                c[field]++
                counts.set(tag, c)
            }
        }
    }
    add(articles, 'articles')
    add(stories, 'stories')

    const entries = [...counts].map(([tag, c]) => ({
        label: tag,
        href: `/topics/${encodeURIComponent(tag)}`,
        note: [c.articles && plural(c.articles, 'article', 'articles'), c.stories && plural(c.stories, 'story', 'stories')].filter(Boolean).join(' · '),
    }))

    return (
        <div className="folio py-6 md:py-8">
            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Topics</h1>
                <p className="text-lede text-ink-soft max-w-[58ch]">Every subject the articles and stories touch on.</p>
            </header>
            {entries.length === 0
                ? <p className="text-ink-soft py-4">Topics appear here as articles are tagged.</p>
                : <AlphaIndex entries={entries} idPrefix="topic" />}
        </div>
    )
}

import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { ARTICLE_LIST_COLUMNS, articleDate, onDaf, orderByPublished } from '@/app/lib/articles'
import { MASECHTOS, findMasechta } from '@/app/lib/shas'
import { buildMetadata } from '@/app/lib/seo'
import { findTopic, tagVariants, topicsFor } from '@/app/lib/topics'
import ArticleRow from '@/app/components/ArticleRow'

export const revalidate = 300

const PER_PAGE = 20

export const metadata = buildMetadata({
    title: 'All Daf Yomi Articles',
    description: 'Every “Delving into the Daf” article by Rabbi Avrohom Sebrow, newest first or in the order of Shas, filterable by masechta and topic.',
    path: '/articles',
})

const SHAS_ORDER = new Map(MASECHTOS.map((m, i) => [m.name, i]))

function hrefWith(params, changes) {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...params, ...changes })) if (v) next.set(k, v)
    const qs = next.toString()
    return qs ? `/articles?${qs}` : '/articles'
}

export default async function ArticlesPage({ searchParams }) {
    const sp = await searchParams
    const masechta = typeof sp.masechta === 'string' ? sp.masechta : ''
    const topic = typeof sp.topic === 'string' ? sp.topic : ''
    const sort = sp.sort === 'shas' ? 'shas' : 'newest'
    const page = Math.max(1, Number.parseInt(sp.page, 10) || 1)
    const params = { masechta, topic, sort: sort === 'shas' ? 'shas' : '' }

    // Daf articles only; the rest are on /beyond-the-daf
    let query = onDaf(supabase.from('articles').select(ARTICLE_LIST_COLUMNS))
    if (masechta) query = query.ilike('masechta', masechta)
    // ?topic= takes a topic name or slug; old spellings of it are matched too
    const topicMatch = topic ? findTopic(topic) : null
    if (topic) query = topicMatch ? query.overlaps('tags', tagVariants(topicMatch)) : query.contains('tags', [topic])

    const [{ data, error }, { data: index }] = await Promise.all([
        orderByPublished(query),
        supabase.from('articles').select('masechta, tags'),
    ])
    let articles = data ?? []
    if (sort === 'newest') {
        articles = [...articles].sort((a, b) => new Date(articleDate(b)) - new Date(articleDate(a)))
    }
    if (sort === 'shas') {
        const order = a => SHAS_ORDER.get(findMasechta(a.masechta)?.name) ?? 999
        articles = [...articles].sort((a, b) => order(a) - order(b) || a.daf - b.daf)
    }

    const total = articles.length
    const pages = Math.max(1, Math.ceil(total / PER_PAGE))
    const shown = articles.slice((page - 1) * PER_PAGE, page * PER_PAGE)

    // Filter choices: only masechtos and topics that have articles
    const masechtos = new Set(), topics = new Set()
    for (const a of index ?? []) {
        if (!a.masechta) continue
        const m = findMasechta(a.masechta)
        masechtos.add(m?.name ?? a.masechta)
        for (const t of topicsFor(a.tags)) topics.add(t.name)
    }
    const masechtaOptions = [...masechtos].sort((a, b) => (SHAS_ORDER.get(a) ?? 999) - (SHAS_ORDER.get(b) ?? 999))
    const topicOptions = [...topics].sort((a, b) => a.localeCompare(b))

    // Group by month (newest) or by masechta (Shas order)
    const groupOf = a => sort === 'shas'
        ? findMasechta(a.masechta)?.name ?? a.masechta
        : new Date(articleDate(a)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const groups = []
    for (const a of shown) {
        const g = groupOf(a)
        if (groups.at(-1)?.name !== g) groups.push({ name: g, items: [] })
        groups.at(-1).items.push(a)
    }

    const filtered = masechta || topic

    return (
        <div className="folio py-6 md:py-8">
            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Articles</h1>
                <p className="text-lede text-ink-soft max-w-[58ch]">Every “Delving into the Daf” article, {sort === 'shas' ? 'in the order of Shas' : 'newest first'}.</p>
                <p className="meta">Tributes, interviews and other writings are in <Link href="/beyond-the-daf">Beyond the Daf</Link>.</p>
            </header>

            <form action="/articles" className="flex flex-wrap items-end gap-2 py-3.5 border-b border-rule">
                <div className="grid gap-1">
                    <label htmlFor="f-masechta" className="meta">Masechta</label>
                    <select id="f-masechta" name="masechta" defaultValue={masechta} className="field w-auto min-w-[11rem]">
                        <option value="">All masechtos</option>
                        {masechtaOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="grid gap-1">
                    <label htmlFor="f-topic" className="meta">Topic</label>
                    <select id="f-topic" name="topic" defaultValue={topic} className="field w-auto min-w-[11rem]">
                        <option value="">All topics</option>
                        {topicOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                {sort === 'shas' && <input type="hidden" name="sort" value="shas" />}
                <button type="submit" className="btn">Show</button>
                {filtered && <Link href={hrefWith({}, { sort: params.sort })} className="btn-quiet">Clear</Link>}
                <div role="group" aria-label="Order" className="inline-flex border border-ink rounded-[2px] ml-auto">
                    <Link href={hrefWith(params, { sort: '', page: '' })} aria-current={sort === 'newest' ? 'true' : undefined} className="plain min-h-11 inline-flex items-center px-3.5 aria-[current=true]:bg-ink aria-[current=true]:text-paper">Newest</Link>
                    <Link href={hrefWith(params, { sort: 'shas', page: '' })} aria-current={sort === 'shas' ? 'true' : undefined} className="plain min-h-11 inline-flex items-center px-3.5 aria-[current=true]:bg-ink aria-[current=true]:text-paper">Shas order</Link>
                </div>
            </form>

            <p className="meta pt-3" aria-live="polite">
                {error ? 'The articles didn’t load. Refresh the page to try again.'
                    : total === 0 ? 'No articles match these filters.'
                    : `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}`}
            </p>

            {groups.map(g => (
                <section key={g.name} aria-label={g.name}>
                    <h2 className="sc pt-5">{g.name}</h2>
                    {g.items.map(a => <ArticleRow key={a.id} article={a} />)}
                </section>
            ))}

            {pages > 1 && (
                <nav aria-label="Pages" className="flex items-center justify-between gap-3 pt-5">
                    {page > 1 ? <Link href={hrefWith(params, { page: page - 1 > 1 ? String(page - 1) : '' })} className="btn-quiet">{sort === 'shas' ? 'Previous page' : 'Newer articles'}</Link> : <span />}
                    <span className="meta">Page {page} of {pages}</span>
                    {page < pages ? <Link href={hrefWith(params, { page: String(page + 1) })} className="btn">{sort === 'shas' ? 'Next page' : 'Older articles'}</Link> : <span />}
                </nav>
            )}
        </div>
    )
}

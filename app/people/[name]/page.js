import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { decodeParam, articlePath, articlePlace } from '@/app/lib/articles'
import { MASECHTOS, findMasechta, masechtaHref, hebrewNumeral } from '@/app/lib/shas'
import { buildMetadata, collectionJsonLd, breadcrumbJsonLd } from '@/app/lib/seo'
import { findPersonBySlug, getStoriesAbout, storyPath, personPath, STORY_CARD_COLUMNS } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import StoryRow from '@/app/components/StoryRow'

export const revalidate = 3600

function describe(person) {
    return `${person.count} Gemara ${person.count === 1 ? 'story' : 'stories'} about ${person.name} from the Daf Yomi, with the masechta and daf of each, explained by Rabbi Avrohom Sebrow.`
}

export async function generateMetadata({ params }) {
    const person = await findPersonBySlug(decodeParam((await params).name))
    if (!person) return {}

    return buildMetadata({
        title: `Stories about ${person.name} in the Gemara`,
        description: describe(person),
        path: personPath(person.name),
        keywords: [`${person.name} stories`, `${person.name} Gemara`, `${person.name} Talmud`, person.name],
    })
}

const ORDER = new Map(MASECHTOS.map((m, i) => [m.name, i]))
const shasOrder = s => ORDER.get(findMasechta(s.masechta)?.name) ?? 999

function list(names) {
    if (names.length <= 1) return names
    return names.flatMap((n, i) => (i === 0 ? [n] : [i === names.length - 1 ? ' and ' : ', ', n]))
}

export default async function PersonPage({ params }) {
    const person = await findPersonBySlug(decodeParam((await params).name))
    if (!person) return notFound()

    const stories = (await getStoriesAbout(person.name, { limit: 500, columns: `${STORY_CARD_COLUMNS}, article_id, position` }))
        .sort((a, b) => shasOrder(a) - shasOrder(b) || (a.daf ?? 0) - (b.daf ?? 0) || (a.position ?? 0) - (b.position ?? 0))
    const path = personPath(person.name)

    // The page leads to the articles: each article that tells a story about this sage,
    // with its stories named quietly underneath (each opens the article, lit up).
    const articleIds = [...new Set(stories.map(s => s.article_id).filter(Boolean))]
    const { data: articleData } = articleIds.length
        ? await supabase.from('articles').select('id, slug, title, masechta, daf, daf_end').in('id', articleIds)
        : { data: [] }
    const byId = new Map((articleData ?? []).map(a => [a.id, a]))
    const groups = []
    const loose = []
    for (const s of stories) {
        const article = byId.get(s.article_id)
        if (!article) { loose.push(s); continue }
        let g = groups.find(g => g.article.id === article.id)
        if (!g) groups.push(g = { article, stories: [] })
        g.stories.push(s)
    }

    const masechtos = [...new Set(stories.map(s => findMasechta(s.masechta)?.name ?? s.masechta).filter(Boolean))]
    const companions = new Map()
    for (const s of stories) for (const p of s.people ?? []) if (p !== person.name) companions.set(p, (companions.get(p) ?? 0) + 1)
    const often = [...companions].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n)

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={collectionJsonLd({
                name: `Stories about ${person.name}`,
                description: describe(person),
                path,
                items: stories.map(s => ({ name: s.title, path: storyPath(s) })),
            })} />
            <JsonLd data={breadcrumbJsonLd([
                { name: 'Sages', path: '/people' },
                { name: person.name, path },
            ])} />

            <nav aria-label="Breadcrumb" className="crumbs">
                <Link href="/stories">Stories</Link>
                <span aria-hidden="true">›</span>
                <Link href="/people">Sages</Link>
            </nav>

            <header className="grid gap-1.5 pb-4 border-b border-rule-hard">
                <p className="sc">Articles with stories about</p>
                <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">{person.name}</h1>
                <p className="meta">
                    {person.count} {person.count === 1 ? 'story' : 'stories'}
                    {masechtos.length > 0 && <>, in {list(masechtos).map((m, i) => (i % 2 === 0 && findMasechta(m)
                        ? <Link key={m} href={masechtaHref(m)}>{m}</Link>
                        : <span key={`${m}-${i}`}>{m}</span>))}</>}
                </p>
            </header>

            {groups.map(({ article, stories }) => (
                <article key={article.id} className="row">
                    <span lang="he" aria-hidden="true" className="row-num numeral">{article.masechta ? hebrewNumeral(article.daf) : ''}</span>
                    <p className="meta">{articlePlace(article)}</p>
                    <h2 className="row-title"><Link href={articlePath(article)}>{article.title}</Link></h2>
                    <p className="meta">
                        {stories.length === 1 ? 'Story' : 'Stories'}: {stories.map((s, i) => (
                            <span key={s.id}>{i > 0 && ', '}<Link href={`${articlePath(article)}#${encodeURIComponent(s.slug)}`}>{s.title}</Link></span>
                        ))}
                    </p>
                </article>
            ))}
            {loose.map(s => <StoryRow key={s.id} story={s} />)}

            {often.length > 0 && (
                <p className="meta pt-5">
                    Often appears with {list(often).map((n, i) => (i % 2 === 0 ? <Link key={n} href={personPath(n)}>{n}</Link> : <span key={`sep-${i}`}>{n}</span>))}.
                </p>
            )}
        </div>
    )
}

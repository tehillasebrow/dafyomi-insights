import Link from 'next/link'
import { notFound, redirect, permanentRedirect } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { getArticlesForDaf, articlePath, dafLabel, ARTICLE_LIST_COLUMNS } from '@/app/lib/articles'
import { findMasechta, titleCase, masechtaHref, masechtaFromParam, masechtaSlug, hebrewNumeral } from '@/app/lib/shas'
import { buildMetadata } from '@/app/lib/seo'
import ArticleRow from '@/app/components/ArticleRow'
import EmptyDaf from '@/app/components/EmptyDaf'

export const revalidate = 300

export async function generateMetadata({ params }) {
    const { masechta, daf } = await params
    const name = titleCase(masechtaFromParam(masechta))
    const articles = Number.isInteger(Number(daf)) ? await getArticlesForDaf(masechtaFromParam(masechta), Number(daf), 'id') : []

    return {
        ...buildMetadata({
            title: `${name} ${daf} Daf Yomi Articles`,
            description: `Daf Yomi articles and insights on ${name} daf ${daf}, by Rabbi Avrohom Sebrow.`,
            path: `${masechtaHref(name)}/${daf}`,
        }),
        // A daf with no article yet isn't worth a search result
        ...(articles.length === 0 && { robots: { index: false, follow: true } }),
    }
}

// The nearest article in the masechta, for a daf that has none yet
async function nearestArticle(masechta, daf) {
    const pick = (op, ascending) => supabase
        .from('articles').select(ARTICLE_LIST_COLUMNS).ilike('masechta', masechta)[op]('daf', daf)
        .order('daf', { ascending }).limit(1).maybeSingle()
    const [{ data: before }, { data: after }] = await Promise.all([pick('lt', false), pick('gt', true)])
    if (!before) return after
    if (!after) return before
    return daf - (before.daf_end ?? before.daf) <= after.daf - daf ? before : after
}

// Lists every article on a daf. With a single article this redirects to it,
// which also keeps the old /daf/{masechta}/{daf} article URLs working.
export default async function DafPage({ params }) {
    const { masechta: rawMasechta, daf: rawDaf } = await params
    const masechta = masechtaFromParam(rawMasechta)
    const daf = Number(rawDaf)
    if (!Number.isInteger(daf)) return notFound()

    const known = findMasechta(masechta)
    if (known && (daf < known.first || daf > known.last)) return notFound()
    if (known && rawMasechta !== masechtaSlug(known.name)) permanentRedirect(`${masechtaHref(known.name)}/${daf}`)

    const articles = await getArticlesForDaf(masechta, daf, ARTICLE_LIST_COLUMNS)
    // Temporary redirect: a second article may be added to this daf later
    if (articles.length === 1) redirect(articlePath(articles[0]))

    const name = known?.name ?? titleCase(masechta)

    if (articles.length === 0) {
        if (!known) return notFound()
        return <EmptyDaf masechta={known} daf={daf} nearest={await nearestArticle(masechta, daf)} />
    }

    return (
        <div className="folio py-6 md:py-8">
            <nav aria-label="Breadcrumb" className="crumbs">
                <Link href="/masechtos">Masechtos</Link>
                <span aria-hidden="true">›</span>
                <Link href={masechtaHref(name)}>{name}</Link>
            </nav>
            <header className="grid gap-1.5 pb-4 border-b border-rule-hard md:grid-cols-[auto_1fr] md:gap-x-7 md:items-end">
                <span lang="he" className="numeral text-[clamp(3.75rem,9vw,6rem)]">{hebrewNumeral(daf)}</span>
                <div>
                    <h1 className="font-semibold text-[clamp(2rem,4.5vw,3rem)] leading-none tracking-[-0.02em]">{name} {daf}</h1>
                    <p className="meta mt-1">{articles.length} articles cover this daf</p>
                </div>
            </header>
            <div>
                {articles.map(a => <ArticleRow key={a.id} article={a} showMasechta={false} headingLevel={2} />)}
            </div>
            <p className="meta pt-4">Articles that cover a range of dafim show the first daf: {articles.map(a => dafLabel(a)).join(', ')}.</p>
        </div>
    )
}

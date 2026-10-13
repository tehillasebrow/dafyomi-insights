import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { ARTICLE_LIST_COLUMNS, BEYOND_THE_DAF, BEYOND_THE_DAF_PATH, articlePath, orderByPublished } from '@/app/lib/articles'
import { buildMetadata, breadcrumbJsonLd, collectionJsonLd } from '@/app/lib/seo'
import JsonLd from '@/app/components/JsonLd'
import ArticleRow from '@/app/components/ArticleRow'

export const revalidate = 300

const DESCRIPTION = 'Tributes, interviews and other writings by Rabbi Avrohom Sebrow beyond the Daf Yomi column.'

export const metadata = buildMetadata({
    title: BEYOND_THE_DAF,
    description: DESCRIPTION,
    path: BEYOND_THE_DAF_PATH,
})

// Articles that aren't about a daf (masechta is null), newest first
export default async function BeyondTheDafPage() {
    const { data, error } = await orderByPublished(
        supabase.from('articles').select(ARTICLE_LIST_COLUMNS).is('masechta', null)
    )
    const articles = data ?? []

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={breadcrumbJsonLd([{ name: BEYOND_THE_DAF, path: BEYOND_THE_DAF_PATH }])} />
            <JsonLd data={collectionJsonLd({
                name: BEYOND_THE_DAF,
                description: DESCRIPTION,
                path: BEYOND_THE_DAF_PATH,
                items: articles.map(a => ({ name: a.title, path: articlePath(a) })),
            })} />

            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">{BEYOND_THE_DAF}</h1>
                <p className="text-lede text-ink-soft max-w-[58ch]">{DESCRIPTION}</p>
            </header>

            <p className="meta pt-3" aria-live="polite">
                {error ? 'The articles didn’t load. Refresh the page to try again.'
                    : articles.length === 0 ? 'Nothing here yet.'
                    : `${articles.length} ${articles.length === 1 ? 'article' : 'articles'}`}
            </p>

            {articles.map(a => <ArticleRow key={a.id} article={a} headingLevel={2} />)}

            <p className="pt-6"><Link href="/articles">All Daf Yomi articles</Link></p>
        </div>
    )
}

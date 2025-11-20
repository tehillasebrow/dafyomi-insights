import { supabase } from '@/app/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Tag } from 'lucide-react'

export const revalidate = 0

// SEO Metadata Generator
export async function generateMetadata({ params }) {
    const { masechta, daf } = await params

    const { data: article } = await supabase
        .from('articles')
        .select('title, summary, masechta, daf')
        .ilike('masechta', masechta)
        .eq('daf', daf)
        .single()

    if (!article) return {}

    return {
        title: `Daf Yomi ${article.masechta} ${article.daf}: ${article.title}`,
        description: article.summary,
    }
}

export default async function ArticlePage({ params }) {
    const { masechta, daf } = await params

    const { data: article } = await supabase
        .from('articles')
        .select('*')
        .ilike('masechta', masechta)
        .eq('daf', daf)
        .single()

    if (!article) return notFound()

    // Google Schema for SEO
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        author: {
            '@type': 'Person',
            name: 'Rabbi Avrohom Sebrow',
        },
        datePublished: article.created_at,
        articleBody: article.content,
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <Link href="/" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 font-sans text-sm font-medium transition">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Articles
            </Link>

            <article>
                <header className="mb-10 text-center">
                    <Link href={`/daf/${article.masechta.toLowerCase()}`} className="inline-block px-4 py-1.5 bg-blue-50 text-blue-800 font-bold text-sm uppercase tracking-wider rounded-full mb-4 hover:bg-blue-100 transition">
                        {article.masechta} {article.daf}
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                        {article.title}
                    </h1>
                    <div className="text-slate-500 font-sans text-sm border-y border-slate-100 py-4">
                        By Rabbi Avrohom Sebrow • {new Date(article.created_at).toLocaleDateString()}
                    </div>
                </header>

                {/* The Article Content */}
                <div className="prose prose-lg prose-slate max-w-none font-serif leading-loose whitespace-pre-line">
                    {article.content}
                </div>

                {/* Tags Footer (Now Clickable!) */}
                {article.tags && (
                    <div className="mt-12 pt-8 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Topics</h3>
                        <div className="flex flex-wrap gap-2">
                            {article.tags.map(tag => (
                                <Link
                                    key={tag}
                                    href={`/topics/${tag.trim()}`}
                                    className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-md hover:bg-blue-600 hover:text-white transition duration-200"
                                >
                                    <Tag className="w-3 h-3 mr-1.5 opacity-50" /> {tag}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </article>
        </div>
    )
}
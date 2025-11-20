import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { notFound } from 'next/navigation'

export const revalidate = 0

export async function generateMetadata({ params }) {
    const { masechta } = await params
    const formattedName = masechta.charAt(0).toUpperCase() + masechta.slice(1)

    return {
        title: `${formattedName} Daf Yomi Articles | Daf Yomi Insights`,
        description: `Halachic insights and Daf Yomi articles on Maseches ${formattedName}.`,
    }
}

export default async function MasechtaPage({ params }) {
    const { masechta } = await params
    const formattedName = masechta.charAt(0).toUpperCase() + masechta.slice(1)

    // Fetch all articles for this specific masechta
    const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .ilike('masechta', masechta)
        .order('daf', { ascending: true }) // Order by Daf number

    if (!articles || articles.length === 0) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                <h1 className="text-4xl font-bold text-slate-900 mb-4">{formattedName}</h1>
                <p className="text-slate-600 mb-8">No articles found for this Masechta yet.</p>
                <Link href="/masechtos" className="text-blue-600 hover:underline">
                    Browse other Masechtos
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-12">
            {/* Header */}
            <div className="mb-12 border-b border-slate-200 pb-8">
                <div className="flex items-center gap-3 mb-2 text-blue-600 font-bold uppercase tracking-wider text-sm">
                    <BookOpen className="w-5 h-5" /> Masechta
                </div>
                <h1 className="text-5xl font-bold text-slate-900">{formattedName}</h1>
                <p className="text-slate-500 mt-2 text-lg">{articles.length} Articles Available</p>
            </div>

            {/* Grid of Articles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article) => (
                    <Link href={`/daf/${article.masechta.toLowerCase()}/${article.daf}`} key={article.id} className="group block h-full">
                        <article className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-full">
                  Daf {article.daf}
                </span>
                                <span className="text-slate-400 text-xs font-sans">
                  {new Date(article.created_at).toLocaleDateString()}
                </span>
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">
                                {article.title}
                            </h3>

                            <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-6 flex-grow font-sans">
                                {article.summary}
                            </p>

                            <div className="flex items-center text-blue-600 font-bold text-sm mt-auto group-hover:translate-x-1 transition-transform">
                                Read <ArrowRight className="w-4 h-4 ml-1" />
                            </div>
                        </article>
                    </Link>
                ))}
            </div>
        </div>
    )
}
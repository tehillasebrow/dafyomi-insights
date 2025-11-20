// app/page.js
import { supabase } from './lib/supabase'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const revalidate = 0 // Fetch new articles instantly

export default async function Home() {
    const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

    return (
        <div className="max-w-6xl mx-auto px-4 py-12">
            {/* Hero Section */}
            <div className="text-center mb-16 space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight">
                    Torah Insights for the <span className="text-blue-600">Daily Daf</span>
                </h1>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto font-sans leading-relaxed">
                    Short, clear, and deep halachic analysis by Rabbi Avrohom Sebrow.
                </p>
            </div>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {articles?.map((article) => (
                    <Link href={`/daf/${article.masechta.toLowerCase()}/${article.daf}`} key={article.id} className="group block h-full">
                        <article className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-full">
                  {article.masechta} {article.daf}
                </span>
                                <span className="text-slate-400 text-xs font-sans">
                  {new Date(article.created_at).toLocaleDateString()}
                </span>
                            </div>

                            <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors leading-snug">
                                {article.title}
                            </h3>

                            <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-6 flex-grow font-sans">
                                {article.summary}
                            </p>

                            <div className="flex items-center text-blue-600 font-bold text-sm mt-auto group-hover:translate-x-1 transition-transform">
                                Read Article <ArrowRight className="w-4 h-4 ml-1" />
                            </div>
                        </article>
                    </Link>
                ))}
            </div>
        </div>
    )
}
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { ArrowRight, Tag } from 'lucide-react'

export const revalidate = 0

export async function generateMetadata({ params }) {
    const { tag } = await params
    const decodedTag = decodeURIComponent(tag)
    return { title: `${decodedTag} Articles | Daf Yomi Insights` }
}

export default async function SingleTopicPage({ params }) {
    const { tag } = await params
    const decodedTag = decodeURIComponent(tag)

    // Fetch articles that contain this specific tag
    const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .contains('tags', [decodedTag]) // Postgres magic to look inside the array
        .order('created_at', { ascending: false })

    return (
        <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="mb-12 border-b border-slate-200 pb-8">
                <div className="flex items-center gap-2 mb-2 text-blue-600 font-bold uppercase tracking-wider text-sm">
                    <Tag className="w-5 h-5" /> Topic
                </div>
                <h1 className="text-5xl font-bold text-slate-900">{decodedTag}</h1>
                <p className="text-slate-500 mt-2 text-lg">{articles?.length || 0} Articles Found</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles?.map((article) => (
                    <Link href={`/daf/${article.masechta.toLowerCase()}/${article.daf}`} key={article.id} className="group block h-full">
                        <article className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-full">
                  {article.masechta} {article.daf}
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
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { Calendar, BookOpen, ArrowLeft } from 'lucide-react'
import DailyDiscussion from '@/app/components/DailyDiscussion'
import { notFound } from 'next/navigation'

export const revalidate = 0

// File: app/daily/[date]/page.js (Update lines 10-21)

export async function generateMetadata({ params }) {
    const { date } = await params
    // Fetch discussion data here to create a rich title
    const { data: daily } = await supabase
        .from('daily_discussions')
        .select('masechta, daf')
        .eq('date', date)
        .single()

    const masechtaDaf = daily ? `${daily.masechta} ${daily.daf}` : 'Daf Yomi Page'
    const formattedDate = new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    return {
        title: `Daf Yomi Discussion: ${masechtaDaf} - ${formattedDate}`,
        description: `Join the daily Daf Yomi discussion and view insights for ${masechtaDaf} on ${formattedDate}.`,
    }
}

export default async function SingleDailyPage({ params }) {
    const { date } = await params

    // Fetch the specific daily discussion
    const { data: daily } = await supabase
        .from('daily_discussions')
        .select('*')
        .eq('date', date)
        .single()

    if (!daily) return notFound()

    // Fetch linked article if it exists
    const { data: article } = await supabase
        .from('articles')
        .select('slug, title, summary')
        .ilike('masechta', daily.masechta)
        .eq('daf', daily.daf)
        .limit(1)
        .maybeSingle()

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <Link href="/daily" className="inline-flex items-center text-slate-500 hover:text-blue-600 mb-8 text-sm font-medium transition">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Today
            </Link>

            {/* Header Card */}
            <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-lg mb-10">
                <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-sm font-medium mb-4 border border-white/10">
                    <Calendar className="w-4 h-4" />
                    {new Date(daily.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">{daily.masechta} {daily.daf}</h1>
                {daily.topic_summary && <p className="text-lg text-slate-300">{daily.topic_summary}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <DailyDiscussion dailyId={daily.id} />
                </div>

                <div className="space-y-6">
                    {article && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-blue-600" />
                                Read Full Insight
                            </h4>
                            <p className="text-sm text-slate-600 mb-4 line-clamp-3">{article.summary}</p>
                            <Link href={`/daf/${daily.masechta.toLowerCase()}/${daily.daf}`} className="block w-full text-center py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-bold">
                                Read Article
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
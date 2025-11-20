import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { Calendar, BookOpen } from 'lucide-react'
import DailyDiscussion from '@/app/components/DailyDiscussion'

export const revalidate = 0

export const metadata = {
    title: 'Today\'s Daily Daf Yomi | Insights & Discussion',
    description: 'Join the conversation on today\'s Daf. Read interesting articles and insights for the Daily Daf Yomi cycle.',
}

export default async function DailyDafPage() {
    // Fetch the entry for TODAY (or the latest one uploaded)
    const { data: daily } = await supabase
        .from('daily_discussions')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single()

    // If no daily discussion is set up in the DB at all
    if (!daily) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                <h1 className="text-3xl font-bold text-slate-900">Daily Daf Discussion</h1>
                <p className="text-slate-600 mt-4">Check back later for today's discussion topic.</p>
            </div>
        )
    }

    // Check if there is a full article matching this Daf
    const { data: article } = await supabase
        .from('articles')
        .select('slug, title, summary')
        .ilike('masechta', daily.masechta)
        .eq('daf', daily.daf)
        .limit(1)
        .maybeSingle()

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">

            {/* Header Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-lg mb-10 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-500/30 px-3 py-1 rounded-full text-sm font-medium mb-4 backdrop-blur-sm border border-blue-400/30">
                    <Calendar className="w-4 h-4" />
                    {new Date(daily.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>

                <h1 className="text-5xl md:text-6xl font-bold mb-4">
                    {daily.masechta} {daily.daf}
                </h1>

                {daily.topic_summary && (
                    <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                        {daily.topic_summary}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Left Column: Discussion */}
                <div className="md:col-span-2">
                    <DailyDiscussion dailyId={daily.id} />
                </div>

                {/* Right Column: Related Article or Resources */}
                <div className="space-y-6">
                    {/* If you wrote an article for this Daf, link it here */}
                    {article ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-blue-600" />
                                Read Full Insight
                            </h4>
                            <p className="text-sm text-slate-600 mb-4 line-clamp-3">{article.summary}</p>
                            <Link
                                href={`/daf/${daily.masechta.toLowerCase()}/${daily.daf}`}
                                className="block w-full text-center py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-bold"
                            >
                                Read Article
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
                            <p className="text-slate-500 text-sm">No full article for this specific Daf yet.</p>
                        </div>
                    )}

                    {/* External Links (Sefaria, etc.) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">External Resources</h4>
                        <a
                            href={`https://www.sefaria.org/${daily.masechta}.${daily.daf}a`}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full text-center py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm mb-2"
                        >
                            Open in Sefaria
                        </a>
                        <a
                            href="[https://www.dafyomi.co.il/](https://www.dafyomi.co.il/)"
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full text-center py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm"
                        >
                            DafYomi.co.il
                        </a>
                    </div>
                </div>

            </div>
        </div>
    )
}
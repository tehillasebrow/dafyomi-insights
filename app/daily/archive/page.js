import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { Calendar, ArrowRight } from 'lucide-react'

export const revalidate = 0

export default async function DailyArchive() {
    const { data: discussions } = await supabase
        .from('daily_discussions')
        .select('*')
        .order('date', { ascending: false })

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-2">
                <Calendar className="w-8 h-8 text-blue-600" />
                Daily Daf Archive
            </h1>

            <div className="grid gap-4">
                {discussions?.map((day) => (
                    <Link
                        key={day.id}
                        href={`/daily/${day.date}`}
                        className="block bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition group"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1">
                                    {new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-700 transition">
                                    {day.masechta} {day.daf}
                                </h3>
                                {day.topic_summary && (
                                    <p className="text-slate-600 text-sm mt-1 line-clamp-1">{day.topic_summary}</p>
                                )}
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition" />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
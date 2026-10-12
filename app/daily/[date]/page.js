import { supabase } from '@/app/lib/supabase'
import { isAdmin } from '@/app/lib/adminAuth'
import { notFound } from 'next/navigation'
import DailyView from '@/app/components/DailyView'
import { formatDate } from '@/app/lib/shas'
import { buildMetadata } from '@/app/lib/seo'

export const revalidate = 0

// Dates are stored as YYYY-MM-DD, so format them in UTC to avoid showing the day before
const LONG_DATE = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

export async function generateMetadata({ params }) {
    const { date } = await params
    // Fetch discussion data here to create a rich title
    const { data: daily } = await supabase
        .from('daily_discussions')
        .select('masechta, daf, topic_summary')
        .eq('date', date)
        .single()

    if (!daily) return {}

    const masechtaDaf = `${daily.masechta} ${daily.daf}`
    const formattedDate = formatDate(date, LONG_DATE)

    return buildMetadata({
        title: `${masechtaDaf} Daf Yomi Discussion – ${formattedDate}`,
        description: daily.topic_summary
            ? `${masechtaDaf} (${formattedDate}): ${daily.topic_summary}`
            : `Join the Daf Yomi discussion on ${masechtaDaf} for ${formattedDate}, with related articles and insights.`,
        path: `/daily/${date}`,
    })
}

export default async function SingleDailyPage({ params }) {
    const { date } = await params
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound()

    const [{ data: daily }, admin] = await Promise.all([
        supabase.from('daily_discussions').select('*').eq('date', date).maybeSingle(),
        isAdmin(),
    ])
    if (!daily) return notFound()

    return <DailyView date={new Date(`${date}T00:00:00Z`)} daily={daily} admin={admin} />
}

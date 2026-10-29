import { supabase } from '@/app/lib/supabase'
import { buildMetadata } from '@/app/lib/seo'
import { todayInNewYork, dafYomiFor } from '@/app/lib/shas'
import DailyView from '@/app/components/DailyView'

// Five-minute cache, like the home page: today's daf can lag a few minutes after midnight.
export const revalidate = 300

// The title names today's daf, the way people search: "Daf Yomi Today: Bechoros 29 (October 18, 2026)"
export async function generateMetadata() {
    const today = todayInNewYork()
    const { masechta, daf } = dafYomiFor(today)
    const date = today.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
    return buildMetadata({
        title: `Daf Yomi Today: ${masechta.name} ${daf} (${date})`,
        description: `Today's Daf Yomi is ${masechta.name} ${daf}. The day's discussion, Daf Yomi articles and Gemara stories on ${masechta.name}, by Rabbi Avrohom Sebrow.`,
        path: '/daily',
    })
}

export default async function DailyDafPage() {
    const today = todayInNewYork()
    const { data: daily } = await supabase.from('daily_discussions').select('*').eq('date', today.toISOString().slice(0, 10)).maybeSingle()
    return <DailyView date={today} daily={daily} />
}

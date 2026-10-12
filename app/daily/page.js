import { supabase } from '@/app/lib/supabase'
import { isAdmin } from '@/app/lib/adminAuth'
import { buildMetadata } from '@/app/lib/seo'
import { todayInNewYork } from '@/app/lib/shas'
import DailyView from '@/app/components/DailyView'

export const revalidate = 0

export const metadata = buildMetadata({
    title: "Today's Daf Yomi: Daily Daf Discussion & Articles",
    description: "Today's Daf Yomi daf with a live discussion, the related Daf Yomi articles and Gemara stories, and insights on the daily Daf by Rabbi Avrohom Sebrow.",
    path: '/daily',
})

export default async function DailyDafPage() {
    const today = todayInNewYork()
    const [{ data: daily }, admin] = await Promise.all([
        supabase.from('daily_discussions').select('*').eq('date', today.toISOString().slice(0, 10)).maybeSingle(),
        isAdmin(),
    ])
    return <DailyView date={today} daily={daily} admin={admin} />
}

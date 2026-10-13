import { ogCard, OG_SIZE } from '@/app/lib/ogCard'
import { getStoryBySlug } from '@/app/lib/stories'
import { decodeParam, BEYOND_THE_DAF } from '@/app/lib/articles'

export const alt = 'Gemara story on Daf Yomi Insights'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function StoryImage({ params }) {
    const story = await getStoryBySlug(decodeParam((await params).slug))
    if (!story) return ogCard({ title: 'Gemara Stories', eyebrow: 'Daf Yomi Insights' })

    return ogCard({
        eyebrow: story.masechta ? `${story.masechta} ${story.daf} · Gemara Story` : `${BEYOND_THE_DAF} · Story`,
        title: story.title,
        subtitle: story.people?.length ? story.people.slice(0, 3).join(' · ') : null,
    })
}

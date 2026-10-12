import { ogCard, OG_SIZE } from '@/app/lib/ogCard'
import { SITE_TAGLINE } from '@/app/lib/site'

export const alt = 'Daf Yomi Insights — Torah insights and Gemara stories on the daily Daf'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function OpengraphImage() {
    return ogCard({
        eyebrow: 'Daf Yomi · Gemara Stories · Insights',
        title: 'Delving into the Daf',
        subtitle: SITE_TAGLINE,
    })
}

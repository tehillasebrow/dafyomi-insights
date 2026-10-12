// POST /api/revalidate with "Authorization: Bearer <REVALIDATE_SECRET>".
// Called by scripts/story-pipeline.mjs after it publishes stories, so new
// pages, the sitemap and /llms.txt update immediately instead of within the hour.
import { revalidatePath } from 'next/cache'
import { createHash, timingSafeEqual } from 'crypto'

const digest = value => createHash('sha256').update(String(value)).digest()

export async function POST(request) {
    const secret = process.env.REVALIDATE_SECRET
    const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) {
        return Response.json({ error: 'Not authorized' }, { status: 401 })
    }

    revalidatePath('/', 'layout')
    revalidatePath('/sitemap.xml')
    revalidatePath('/llms.txt')
    revalidatePath('/llms-full.txt')
    return Response.json({ revalidated: true, at: new Date().toISOString() })
}

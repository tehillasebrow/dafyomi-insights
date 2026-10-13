// POST /api/newsletter/queue with "Authorization: Bearer <REVALIDATE_SECRET>"
// and a JSON body { "ids": [<article id>, ...] }. Called by the newspaper import
// (scripts/import/publish.mjs) after it publishes new articles. Each one gets a
// pending email and a preview to the admin; articles older than 7 days are ignored.
import { isAuthorizedScript, queueArticleEmail } from '@/app/lib/newsletter'

const MAX_IDS = 10

export async function POST(request) {
    if (!isAuthorizedScript(request)) {
        return Response.json({ error: 'Not authorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body.ids) ? body.ids.slice(0, MAX_IDS) : []
    const results = []
    for (const id of ids) results.push({ id, ...(await queueArticleEmail(id)) })
    return Response.json({ results })
}

// POST /api/newsletter/tick with "Authorization: Bearer <REVALIDATE_SECRET>".
// Run hourly by .github/workflows/newsletter.yml: sends approved emails that waited
// for Shabbos/Yom Tov to end (or failed and need a retry), and reminds the admin
// once about a preview that has waited two days.
import { isAuthorizedScript, runNewsletterTick } from '@/app/lib/newsletter'

export const maxDuration = 300

export async function POST(request) {
    if (!isAuthorizedScript(request)) {
        return Response.json({ error: 'Not authorized' }, { status: 401 })
    }
    return Response.json(await runNewsletterTick())
}

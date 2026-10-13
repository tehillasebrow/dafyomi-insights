// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe
// header on every newsletter email. People clicking the link in the email go to
// /unsubscribe instead.
import { unsubscribeByToken } from '@/app/lib/newsletter'

export async function POST(request) {
    const token = new URL(request.url).searchParams.get('token')
    await unsubscribeByToken(token)
    return new Response(null, { status: 200 })
}

'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin'
import { isAdmin } from '@/app/lib/adminAuth'
import { logEvent, isBot } from '@/app/lib/events'
import { normalizeEmail, deliverSend, countSubscribers, unsubscribeByToken } from '@/app/lib/newsletter'

const NOT_AUTHORIZED = '❌ Not authorized. Please log in again.'
const SOURCES = new Set(['popup', 'footer', 'unsubscribe_page'])

// --- Public: sign up ---

export async function subscribe(prevState, formData) {
    // Bots fill in the hidden "website" field; pretend it worked
    if (formData.get('website') || (await isBot())) return { ok: true }

    const email = normalizeEmail(formData.get('email'))
    if (!email) return { error: 'Please enter a valid email address.' }
    const source = SOURCES.has(formData.get('source')) ? formData.get('source') : null

    const supabase = getSupabaseAdmin()
    const { data: existing, error: readError } = await supabase.from('subscribers').select('id, status').eq('email', email).maybeSingle()
    if (readError) return { error: 'Something went wrong. Please try again.' }

    if (!existing) {
        const { error } = await supabase.from('subscribers').insert([{ email, source }])
        // A double-click can race the insert; the unique email makes the second one a no-op
        if (error && error.code !== '23505') return { error: 'Something went wrong. Please try again.' }
    } else if (existing.status !== 'subscribed') {
        const { error } = await supabase.from('subscribers').update({ status: 'subscribed', unsubscribed_at: null }).eq('id', existing.id)
        if (error) return { error: 'Something went wrong. Please try again.' }
    }

    if (!existing || existing.status !== 'subscribed') await logEvent('subscribe', { details: { source } })
    return { ok: true }
}

// --- Public: unsubscribe (the button on /unsubscribe) ---

export async function unsubscribe(prevState, formData) {
    const row = await unsubscribeByToken(String(formData.get('token') ?? ''))
    if (!row) return { error: 'This unsubscribe link is not valid. It may have been mistyped.' }
    await logEvent('unsubscribe', { path: '/unsubscribe' })
    return { ok: true, email: row.email }
}

// --- Admin ---

export async function approveSend(prevState, formData) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const id = Number(formData.get('id'))
    if (!Number.isInteger(id)) return { error: '❌ Invalid email' }

    const { data, error } = await getSupabaseAdmin()
        .from('newsletter_sends')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
    if (error) return { error: `❌ Error: ${error.message}` }
    if (!data?.length) return { error: '❌ This email was already approved or skipped.' }

    await logEvent('newsletter_approved', { path: `/admin/newsletter/${id}`, details: { send_id: id } })
    const result = await deliverSend(id)
    revalidatePath(`/admin/newsletter/${id}`)

    if (result.held) return { success: '✅ Approved. It is Shabbos or Yom Tov now, so it will go out automatically afterwards.' }
    if (result.error) return { error: `❌ Approved, but sending failed: ${result.error}. It will be retried automatically within the hour.` }
    await logEvent('newsletter_sent', { details: { send_id: id, recipients: result.sent } })
    return { success: `✅ Sent to ${result.sent} subscriber${result.sent === 1 ? '' : 's'}.` }
}

export async function skipSend(prevState, formData) {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const id = Number(formData.get('id'))
    if (!Number.isInteger(id)) return { error: '❌ Invalid email' }

    const { data, error } = await getSupabaseAdmin()
        .from('newsletter_sends')
        .update({ status: 'skipped' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
    if (error) return { error: `❌ Error: ${error.message}` }
    if (!data?.length) return { error: '❌ This email was already approved or skipped.' }

    await logEvent('newsletter_skipped', { path: `/admin/newsletter/${id}`, details: { send_id: id } })
    revalidatePath(`/admin/newsletter/${id}`)
    return { success: '✅ Skipped. This article will not be emailed.' }
}

export async function getNewsletterOverview() {
    if (!(await isAdmin())) return { error: NOT_AUTHORIZED }
    const supabase = getSupabaseAdmin()

    const [subscribers, recent, sends] = await Promise.all([
        countSubscribers(supabase),
        supabase.from('subscribers').select('id, email, status, source, created_at').order('id', { ascending: false }).limit(25),
        supabase.from('newsletter_sends').select('id, status, created_at, sent_at, recipient_count, last_error, article_id').order('id', { ascending: false }).limit(20),
    ])
    if (recent.error) return { error: recent.error.message }
    if (sends.error) return { error: sends.error.message }

    const ids = sends.data.map(s => s.article_id)
    const { data: articles } = ids.length
        ? await supabase.from('articles').select('id, title, masechta, daf').in('id', ids)
        : { data: [] }
    const byId = new Map((articles || []).map(a => [a.id, a]))

    return {
        error: null,
        subscribers,
        recent: recent.data,
        sends: sends.data.map(s => ({ ...s, article: byId.get(s.article_id) ?? null })),
    }
}

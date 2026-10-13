// lib/newsletter.js
// The mailing list: a preview of each new article goes to the admin
// (NEWSLETTER_PREVIEW_TO), and only after it's approved does it go to subscribers.
// Email is sent with Resend's REST API (RESEND_API_KEY).
import 'server-only'
import { createHash, timingSafeEqual } from 'crypto'
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin'
import { articleOpening, articlePath, articlePlace } from '@/app/lib/articles'
import { postingStatus } from '@/app/lib/shas'
import { SITE_URL, SITE_NAME, AUTHOR } from '@/app/lib/site'

const RESEND_API = 'https://api.resend.com'
const BATCH_SIZE = 100 // Resend's batch limit
// Only articles this recent are emailed, so a bulk backfill of old columns never mails anyone
const MAX_AGE_DAYS = 7
const REMIND_AFTER_HOURS = 48
const STALE_SENDING_MINUTES = 15

const ARTICLE_COLUMNS = 'id, slug, title, summary, content, masechta, daf, daf_end, image_url, published_at, created_at'

export const MAX_EMAIL_LENGTH = 254

export function normalizeEmail(value) {
    const email = String(value ?? '').trim().toLowerCase()
    return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// --- Auth for the scripts (same secret as /api/revalidate) ---

const digest = value => createHash('sha256').update(String(value)).digest()

export function isAuthorizedScript(request) {
    const secret = process.env.REVALIDATE_SECRET
    const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    return Boolean(secret && given && timingSafeEqual(digest(given), digest(secret)))
}

// --- Rendering ---

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function articleUrl(article) {
    return `${SITE_URL}${articlePath(article)}`
}

export function unsubscribeUrl(token) {
    return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`
}

export function emailSubject(article) {
    return `${article.title} (${articlePlace(article)})`
}

// One article: picture, title, masechta/daf, the opening lines and a "Read more" button.
// `banner` is extra HTML shown above it (the admin's preview uses it for the approve link).
export function renderArticleEmail(article, { unsubscribe, banner = '', bannerText = '' } = {}) {
    const url = articleUrl(article)
    const opening = articleOpening(article, 420)
    const where = articlePlace(article)

    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(article.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f2;color:#121317;font-family:Georgia,'Times New Roman',serif;">
${banner}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f2;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:#1c1e23;color:#f1eee5;padding:16px 24px;font-size:20px;font-weight:bold;">
<a href="${SITE_URL}" style="color:#f1eee5;text-decoration:none;">${escapeHtml(SITE_NAME)}</a>
<div style="font-family:'Courier New',monospace;font-size:13px;font-weight:normal;color:#c9c6bc;margin-top:4px;">${escapeHtml(AUTHOR.column)} · ${escapeHtml(AUTHOR.name)}</div>
</td></tr>
${article.image_url ? `<tr><td><a href="${url}"><img src="${escapeHtml(article.image_url)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>` : ''}
<tr><td style="background:#ffffff;padding:24px;border:1px solid #bfbeb6;border-top:0;">
<div style="font-family:'Courier New',monospace;font-size:13px;color:#7a5b12;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(where)}</div>
<h1 style="font-size:26px;line-height:1.25;margin:8px 0 16px;"><a href="${url}" style="color:#121317;text-decoration:none;">${escapeHtml(article.title)}</a></h1>
<p style="font-size:18px;line-height:1.6;margin:0 0 24px;color:#313339;">${escapeHtml(opening)}</p>
<a href="${url}" style="display:inline-block;background:#121317;color:#f5f5f2;font-family:'Courier New',monospace;font-size:16px;padding:14px 24px;text-decoration:none;border-radius:4px;">Read more →</a>
</td></tr>
<tr><td style="padding:20px 24px;font-family:'Courier New',monospace;font-size:12px;line-height:1.6;color:#45474e;text-align:center;">
You're getting this because you signed up at <a href="${SITE_URL}" style="color:#45474e;">dafyomiinsights.com</a>.<br>
<a href="${unsubscribe}" style="color:#45474e;">Unsubscribe</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

    const text = [
        bannerText,
        `${SITE_NAME}: ${AUTHOR.column}`,
        '',
        where,
        article.title,
        '',
        opening,
        '',
        `Read more: ${url}`,
        '',
        `Unsubscribe: ${unsubscribe}`,
    ].filter(line => line !== undefined).join('\n').trim()

    return { subject: emailSubject(article), html, text }
}

function previewBanner(sendId, { reminder = false } = {}) {
    const approveUrl = `${SITE_URL}/admin/newsletter/${sendId}`
    const heading = reminder ? 'Reminder: this email is still waiting for your OK' : 'Preview: only you got this'
    return {
        url: approveUrl,
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#c8a24a;"><tr><td align="center" style="padding:16px;font-family:Arial,sans-serif;color:#121317;">
<strong style="font-size:16px;">${heading}</strong><br>
<span style="font-size:14px;">Nothing goes to subscribers until you approve it.</span><br>
<a href="${approveUrl}" style="display:inline-block;margin-top:10px;background:#121317;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:4px;font-weight:bold;">Review &amp; approve</a>
</td></tr></table>`,
        text: `${heading.toUpperCase()}\nNothing goes to subscribers until you approve it.\nReview & approve: ${approveUrl}\n\n----------------------------------------\n`,
    }
}

// --- Resend ---

function fromAddress() {
    return process.env.NEWSLETTER_FROM || `${SITE_NAME} <articles@dafyomiinsights.com>`
}

function previewRecipients() {
    return String(process.env.NEWSLETTER_PREVIEW_TO || '').split(',').map(normalizeEmail).filter(Boolean)
}

async function resend(path, body) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    const res = await fetch(`${RESEND_API}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Resend ${res.status}: ${data.message || res.statusText}`)
    return data
}

function replyTo() {
    return process.env.NEWSLETTER_REPLY_TO || undefined
}

// --- Loading ---

async function loadSend(supabase, id) {
    const { data, error } = await supabase.from('newsletter_sends').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data
}

async function loadArticle(supabase, id) {
    const { data, error } = await supabase.from('articles').select(ARTICLE_COLUMNS).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data
}

export async function countSubscribers(supabase = getSupabaseAdmin()) {
    const { count } = await supabase.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'subscribed')
    return count ?? 0
}

// For the admin approval page: the send, its article, and the email exactly as subscribers get it
export async function getSendPreview(id) {
    const supabase = getSupabaseAdmin()
    const send = await loadSend(supabase, id)
    if (!send) return null
    const article = await loadArticle(supabase, send.article_id)
    if (!article) return null
    const email = renderArticleEmail(article, { unsubscribe: unsubscribeUrl('preview') })
    return { send, article, email, subscribers: await countSubscribers(supabase) }
}

// --- Preview ---

async function sendPreview(supabase, send, article, { reminder = false } = {}) {
    const to = previewRecipients()
    if (!to.length) throw new Error('NEWSLETTER_PREVIEW_TO is not set')
    const banner = previewBanner(send.id, { reminder })
    const email = renderArticleEmail(article, { unsubscribe: unsubscribeUrl('preview'), banner: banner.html, bannerText: banner.text })
    await resend('/emails', {
        from: fromAddress(),
        to,
        subject: `${reminder ? 'Reminder: ' : ''}[Approve?] ${email.subject}`,
        html: email.html,
        text: email.text,
    })
}

// Called when an article is added (admin form or the weekly import). Creates the
// pending email and sends the admin a preview. Never throws: a failed email must
// not break publishing the article.
export async function queueArticleEmail(articleId) {
    try {
        const supabase = getSupabaseAdmin()
        const article = await loadArticle(supabase, articleId)
        if (!article) return { skipped: 'article not found' }

        const published = new Date(article.published_at || article.created_at).getTime()
        if (Date.now() - published > MAX_AGE_DAYS * 86400000) return { skipped: 'older than 7 days' }

        const { data: rows, error } = await supabase
            .from('newsletter_sends')
            .upsert({ article_id: article.id }, { onConflict: 'article_id', ignoreDuplicates: true })
            .select('*')
        if (error) throw new Error(error.message)
        const send = rows?.[0]
        if (!send) return { skipped: 'already queued' }

        await sendPreview(supabase, send, article)
        await supabase.from('newsletter_sends').update({ preview_sent_at: new Date().toISOString() }).eq('id', send.id)
        return { queued: send.id }
    } catch (err) {
        console.error('queueArticleEmail failed:', err)
        return { error: err.message }
    }
}

// --- Sending to subscribers ---

// Sends an approved email, unless it's Shabbos/Yom Tov (then the hourly job sends it
// afterwards). Claims the row first so two runs can never send it twice, and records
// progress after every batch so a failure resumes where it stopped.
export async function deliverSend(id) {
    if (postingStatus().closed) return { held: true }

    const supabase = getSupabaseAdmin()
    const { data: claimed, error: claimError } = await supabase
        .from('newsletter_sends')
        .update({ status: 'sending', sending_started_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'approved')
        .select('*')
    if (claimError) throw new Error(claimError.message)
    const send = claimed?.[0]
    if (!send) return { skipped: 'not approved or already sending' }

    let { last_subscriber_id: after, recipient_count: count } = send
    try {
        const article = await loadArticle(supabase, send.article_id)
        if (!article) throw new Error('Article was deleted')

        for (;;) {
            const { data: batch, error } = await supabase
                .from('subscribers')
                .select('id, email, unsubscribe_token')
                .eq('status', 'subscribed')
                .gt('id', after)
                .order('id')
                .limit(BATCH_SIZE)
            if (error) throw new Error(error.message)
            if (!batch.length) break

            await resend('/emails/batch', batch.map(s => {
                const unsubscribe = unsubscribeUrl(s.unsubscribe_token)
                const email = renderArticleEmail(article, { unsubscribe })
                return {
                    from: fromAddress(),
                    to: [s.email],
                    reply_to: replyTo(),
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                    headers: {
                        'List-Unsubscribe': `<${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(s.unsubscribe_token)}>`,
                        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                    },
                }
            }))

            after = batch.at(-1).id
            count += batch.length
            await supabase.from('newsletter_sends').update({ last_subscriber_id: after, recipient_count: count }).eq('id', id)
        }

        await supabase.from('newsletter_sends')
            .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
            .eq('id', id)
        return { sent: count }
    } catch (err) {
        // Back to approved: the hourly job retries from where it stopped
        await supabase.from('newsletter_sends').update({ status: 'approved', last_error: String(err.message).slice(0, 500) }).eq('id', id)
        console.error('deliverSend failed:', err)
        return { error: err.message, sent: count }
    }
}

// --- Hourly job ---

export async function runNewsletterTick() {
    const supabase = getSupabaseAdmin()
    const now = Date.now()
    const report = { sent: [], held: [], reminded: [], errors: [] }

    // A send that died mid-way (e.g. the server timed out) goes back to approved
    await supabase.from('newsletter_sends')
        .update({ status: 'approved' })
        .eq('status', 'sending')
        .lt('sending_started_at', new Date(now - STALE_SENDING_MINUTES * 60000).toISOString())

    const { data: approved } = await supabase.from('newsletter_sends').select('id').eq('status', 'approved').order('id')
    for (const { id } of approved || []) {
        const result = await deliverSend(id)
        if (result.held) report.held.push(id)
        else if (result.error) report.errors.push({ id, error: result.error })
        else if (result.sent !== undefined) report.sent.push({ id, recipients: result.sent })
    }

    // One reminder for a preview that's been waiting two days
    const { data: waiting } = await supabase.from('newsletter_sends')
        .select('*')
        .eq('status', 'pending')
        .is('reminded_at', null)
        .lt('preview_sent_at', new Date(now - REMIND_AFTER_HOURS * 3600000).toISOString())
    for (const send of waiting || []) {
        try {
            const article = await loadArticle(supabase, send.article_id)
            if (!article) continue
            await sendPreview(supabase, send, article, { reminder: true })
            await supabase.from('newsletter_sends').update({ reminded_at: new Date().toISOString() }).eq('id', send.id)
            report.reminded.push(send.id)
        } catch (err) {
            report.errors.push({ id: send.id, error: err.message })
        }
    }

    return report
}

// --- Subscribers ---

export async function unsubscribeByToken(token) {
    if (!token || typeof token !== 'string' || token.length > 100) return null
    const { data } = await getSupabaseAdmin()
        .from('subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
        .eq('unsubscribe_token', token)
        .select('email')
    return data?.[0] ?? null
}

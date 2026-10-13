import Link from 'next/link'
import { Mail } from 'lucide-react'
import { isAdmin } from '@/app/lib/adminAuth'
import { getSendPreview } from '@/app/lib/newsletter'
import { articlePath, articlePlace } from '@/app/lib/articles'
import LoginForm from '../../LoginForm'
import ApprovePanel from './ApprovePanel'

export const dynamic = 'force-dynamic'
// Approving sends to every subscriber from this page's server action
export const maxDuration = 300

export const metadata = {
    title: 'Approve email',
    robots: { index: false, follow: false },
}

const STATUS = {
    pending: 'Waiting for your approval',
    approved: 'Approved: goes out automatically after Shabbos/Yom Tov, or on the next retry',
    sending: 'Sending now…',
    sent: 'Sent',
    skipped: 'Skipped: not emailed',
}

const when = value => value && new Date(value).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })

export default async function ApproveEmailPage({ params }) {
    const { id } = await params

    if (!(await isAdmin())) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold mb-8 flex items-center gap-2"><Mail className="w-6 h-6 text-blue-600" /> Approve email</h1>
                <p className="mb-4 text-slate-600">Log in to review this email.</p>
                <LoginForm />
            </div>
        )
    }

    const preview = /^\d+$/.test(id) ? await getSendPreview(Number(id)) : null
    if (!preview) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12">
                <p>This email wasn’t found. <Link href="/admin" className="underline">Back to admin</Link></p>
            </div>
        )
    }

    const { send, article, email, subscribers } = preview
    return (
        <div className="max-w-3xl mx-auto px-4 py-12 grid gap-6">
            <h1 className="text-3xl font-bold flex items-center gap-2"><Mail className="w-6 h-6 text-blue-600" /> Approve email</h1>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-2 text-slate-800">
                <div><b>Article:</b> <Link href={articlePath(article)} className="underline" target="_blank">{article.title}</Link> ({articlePlace(article)})</div>
                <div><b>Subject:</b> {email.subject}</div>
                <div><b>Status:</b> {STATUS[send.status] ?? send.status}</div>
                {send.status === 'sent' && <div><b>Sent:</b> {when(send.sent_at)} to {send.recipient_count} subscriber{send.recipient_count === 1 ? '' : 's'}</div>}
                {send.last_error && send.status !== 'sent' && <div className="text-red-600"><b>Last error:</b> {send.last_error}</div>}
                {send.status === 'pending' && <ApprovePanel id={send.id} subscribers={subscribers} />}
            </div>

            <div className="grid gap-2">
                <h2 className="font-bold text-slate-600">This is exactly what subscribers will get:</h2>
                <iframe title="Email preview" srcDoc={email.html} sandbox="" className="w-full h-[80vh] rounded-xl border border-slate-200 bg-white" />
            </div>

            <Link href="/admin" className="underline text-slate-600">← Back to admin</Link>
        </div>
    )
}

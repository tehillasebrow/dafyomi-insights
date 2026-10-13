'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { getNewsletterOverview } from '@/app/lib/newsletterActions'
import { articlePlace } from '@/app/lib/articles'

const STATUS_LABELS = {
    pending: ['Needs approval', 'bg-amber-50 text-amber-700'],
    approved: ['Approved, waiting', 'bg-blue-50 text-blue-700'],
    sending: ['Sending', 'bg-blue-50 text-blue-700'],
    sent: ['Sent', 'bg-green-50 text-green-700'],
    skipped: ['Skipped', 'bg-slate-100 text-slate-600'],
}

const date = value => new Date(value).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })

export default function MailingList() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [reload, setReload] = useState(0)

    useEffect(() => {
        let cancelled = false
        getNewsletterOverview().then(result => {
            if (cancelled) return
            setData(result)
            setLoading(false)
        })
        return () => { cancelled = true }
    }, [reload])

    function load() {
        setLoading(true)
        setReload(n => n + 1)
    }

    if (!data) return <p className="text-slate-500">Loading…</p>
    if (data.error) return <p className="p-4 rounded-lg bg-red-50 text-red-600 font-bold">{data.error}</p>

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <div className="text-3xl font-bold">{data.subscribers}</div>
                    <div className="text-slate-500">subscriber{data.subscribers === 1 ? '' : 's'}</div>
                </div>
                <button onClick={load} disabled={loading} className="text-slate-500 hover:text-blue-600 flex items-center gap-1 text-sm">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="font-bold mb-3">Article emails</h2>
                {data.sends.length === 0
                    ? <p className="text-slate-500 text-sm">None yet. When a new article is added you’ll get a preview email to approve.</p>
                    : (
                        <ul className="divide-y divide-slate-100">
                            {data.sends.map(s => {
                                const [label, color] = STATUS_LABELS[s.status] ?? [s.status, 'bg-slate-100 text-slate-600']
                                return (
                                    <li key={s.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${color}`}>{label}</span>
                                        <Link href={`/admin/newsletter/${s.id}`} className="font-medium underline flex-1 min-w-[12rem]">
                                            {s.article ? `${s.article.title} (${articlePlace(s.article)})` : 'Deleted article'}
                                        </Link>
                                        <span className="text-xs text-slate-500">
                                            {s.status === 'sent' ? `${date(s.sent_at)} · ${s.recipient_count} sent` : date(s.created_at)}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="font-bold mb-3">Recent sign-ups</h2>
                {data.recent.length === 0
                    ? <p className="text-slate-500 text-sm">No one has signed up yet.</p>
                    : (
                        <ul className="divide-y divide-slate-100 text-sm">
                            {data.recent.map(s => (
                                <li key={s.id} className="py-2 flex flex-wrap gap-x-3">
                                    <span className={`flex-1 min-w-[12rem] break-all ${s.status === 'unsubscribed' ? 'line-through text-slate-400' : ''}`}>{s.email}</span>
                                    <span className="text-slate-500">{s.source || '—'} · {date(s.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </section>
        </div>
    )
}

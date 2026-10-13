'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { getSiteStats, getSiteEvents } from './actions'

const RANGES = [
    { days: 1, label: '24h' },
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
]

const FILTERS = [
    { value: '', label: 'Everything' },
    { value: 'page_view', label: 'Page views' },
    { value: 'search', label: 'Searches' },
    { value: 'audit', label: 'Comments & admin actions' },
]

const TYPE_LABELS = {
    page_view: 'Viewed',
    search: 'Searched',
    search_click: 'Clicked result',
    comment: 'Commented',
    comment_deleted: 'Deleted comment',
    article_created: 'Published article',
    daily_created: 'Set daily daf',
    admin_login: 'Admin login',
    admin_login_failed: 'Failed login',
    admin_logout: 'Admin logout',
    subscribe: 'Subscribed to emails',
    unsubscribe: 'Unsubscribed',
    newsletter_approved: 'Approved email',
    newsletter_sent: 'Sent email',
    newsletter_skipped: 'Skipped email',
}

const TYPE_COLORS = {
    page_view: 'bg-slate-100 text-slate-600',
    search: 'bg-blue-50 text-blue-700',
    search_click: 'bg-blue-50 text-blue-700',
    comment: 'bg-green-50 text-green-700',
    admin_login_failed: 'bg-red-50 text-red-700',
    comment_deleted: 'bg-red-50 text-red-700',
}

function device(ua = '') {
    if (!ua) return ''
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other'
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
    return [browser, os].filter(Boolean).join(' · ')
}

function describe(e) {
    switch (e.type) {
        case 'search': return <>“{e.query}” <span className="text-slate-400">({e.details?.results ?? 0} results)</span></>
        case 'search_click': return <>“{e.query}” → {e.path}</>
        case 'comment': return <>{e.details?.author}: “{String(e.details?.content || '').slice(0, 80)}”</>
        case 'comment_deleted': return <>{e.details?.comment?.author_name}: “{String(e.details?.comment?.content || '').slice(0, 80)}”</>
        case 'article_created': return <>{e.details?.title}</>
        default: return <>{e.path}{e.referrer && <span className="text-slate-400"> from {hostOf(e.referrer)}</span>}</>
    }
}

function hostOf(url) {
    try { return new URL(url).host } catch { return url }
}

function TopList({ title, rows }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h4 className="font-bold text-sm mb-3">{title}</h4>
            {!rows?.length && <p className="text-xs text-slate-400 italic">Nothing yet</p>}
            <ul className="space-y-1 text-sm">
                {rows?.map((r) => (
                    <li key={r.label} className="flex justify-between gap-2">
                        <span className="truncate" title={r.label}>{r.label || '(none)'}</span>
                        <span className="text-slate-500 tabular-nums flex-shrink-0">{r.count}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default function VisitorLog() {
    const [days, setDays] = useState(7)
    const [filter, setFilter] = useState('')
    const [visitorId, setVisitorId] = useState('')
    const [stats, setStats] = useState(null)
    const [events, setEvents] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)

    // Wraps a state change so the spinner shows while the effect below refetches
    // (skipped when the value doesn't change, since the effect wouldn't rerun)
    const reloading = (set, current) => (value) => {
        if (value === current) return
        setLoading(true)
        set(value)
    }
    const refresh = () => { setLoading(true); setReloadKey(k => k + 1) }
    const pickDays = reloading(setDays, days)
    const pickFilter = reloading(setFilter, filter)
    const pickVisitor = reloading(setVisitorId, visitorId)

    useEffect(() => {
        let cancelled = false
        Promise.all([
            getSiteStats(days),
            getSiteEvents({ type: filter, visitorId }),
        ]).then(([s, e]) => {
            if (cancelled) return
            setError(s.error || e.error || '')
            if (s.stats) setStats(s.stats)
            if (e.events) setEvents(e.events)
            setLoading(false)
        })
        return () => { cancelled = true }
    }, [days, filter, visitorId, reloadKey])

    const maxDay = Math.max(1, ...(stats?.by_day || []).map(d => d.count))

    return (
        <div className="space-y-6 font-sans">
            <div className="flex flex-wrap items-center gap-2">
                {RANGES.map(r => (
                    <button key={r.days} onClick={() => pickDays(r.days)} className={`px-3 py-1 rounded-full text-sm border transition ${days === r.days ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>{r.label}</button>
                ))}
                <button onClick={refresh} disabled={loading} className="ml-auto text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-bold">❌ {error}</div>}

            {stats && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[['Page views', stats.page_views], ['Visitors', stats.visitors], ['Searches', stats.searches], ['Comments', stats.comments]].map(([label, value]) => (
                            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                                <div className="text-xs text-slate-500">{label}</div>
                                <div className="text-2xl font-bold tabular-nums">{value ?? 0}</div>
                            </div>
                        ))}
                    </div>

                    {stats.by_day?.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <h4 className="font-bold text-sm mb-3">Views per day</h4>
                            <ul className="space-y-1 text-xs">
                                {stats.by_day.map(d => (
                                    <li key={d.day} className="flex items-center gap-2">
                                        <span className="w-20 text-slate-500 tabular-nums">{d.day}</span>
                                        <span className="flex-grow h-3 bg-slate-100 rounded"><span className="block h-3 bg-blue-500 rounded" style={{ width: `${(d.count / maxDay) * 100}%` }} /></span>
                                        <span className="w-24 text-right tabular-nums">{d.count} · {d.visitors} ppl</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                        <TopList title="Top pages" rows={stats.top_pages} />
                        <TopList title="Top searches" rows={stats.top_searches} />
                        <TopList title="Came from" rows={stats.top_referrers} />
                        <TopList title="Countries" rows={stats.top_countries} />
                    </div>
                </>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h4 className="font-bold text-sm mr-auto">Activity</h4>
                    {visitorId && (
                        <button onClick={() => pickVisitor('')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                            Visitor {visitorId.slice(0, 8)} <X className="w-3 h-3" />
                        </button>
                    )}
                    <select value={filter} onChange={(e) => pickFilter(e.target.value)} className="text-sm border rounded-lg p-1">
                        {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="text-left text-slate-500 border-b">
                            <tr><th className="py-2 pr-3">When</th><th className="pr-3">What</th><th className="pr-3">Details</th><th className="pr-3">Where</th><th className="pr-3">Who</th></tr>
                        </thead>
                        <tbody>
                            {events.length === 0 && <tr><td colSpan={5} className="py-4 text-slate-400 italic">No activity yet</td></tr>}
                            {events.map(e => (
                                <tr key={e.id} className="border-b border-slate-100 align-top">
                                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{new Date(e.created_at).toLocaleString()}</td>
                                    <td className="pr-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full ${TYPE_COLORS[e.type] || 'bg-amber-50 text-amber-700'}`}>{TYPE_LABELS[e.type] || e.type}</span>{e.is_admin && <span className="ml-1 text-slate-400">(you)</span>}</td>
                                    <td className="pr-3 max-w-[220px] break-words">{describe(e)}</td>
                                    <td className="pr-3 whitespace-nowrap">{[e.city, e.country].filter(Boolean).join(', ') || '—'}</td>
                                    <td className="pr-3 whitespace-nowrap">
                                        {e.visitor_id
                                            ? <button onClick={() => pickVisitor(e.visitor_id)} className="text-blue-600 hover:underline" title="Show only this visitor">{e.visitor_id.slice(0, 8)}</button>
                                            : '—'}
                                        <div className="text-slate-400">{e.ip}</div>
                                        <div className="text-slate-400">{device(e.user_agent)}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

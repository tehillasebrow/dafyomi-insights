'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { articlePath, articlePlace, dafPath } from '@/app/lib/articles'
import { storyPath, storyPlace } from '@/app/lib/stories'
import { parseDafQuery, hebrewNumeral } from '@/app/lib/shas'
import { trackSearch, trackSearchClick } from '@/app/lib/track'

// Prefix match on every word: "bechoros 23" -> "bechoros:* & 23:*". Avoids tsquery syntax errors.
function toTsQuery(q) {
    const words = q.match(/[\p{L}\p{N}]+/gu) ?? []
    return words.map(w => `${w}:*`).join(' & ')
}

// For PostgREST .or() filters: drop characters that have meaning in the filter syntax.
const safeLike = q => q.replace(/[%_,()*\\.:"]/g, ' ').trim()

function Highlight({ text, query }) {
    const words = (query.match(/[\p{L}\p{N}]{2,}/gu) ?? []).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (!words.length || !text) return text ?? null
    const parts = String(text).split(new RegExp(`(${words.join('|')})`, 'giu'))
    return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))
}

const GROUPS = [
    ['daf', 'Go to a daf'],
    ['story', 'Stories'],
    ['article', 'Articles'],
]

export default function Search() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    // Results are kept with the query they answer, so a stale answer is never shown
    const [found, setFound] = useState({ q: '', articles: [], stories: [], failed: false })
    const [loading, setLoading] = useState(false)
    const [active, setActive] = useState(0)
    const router = useRouter()
    const inputRef = useRef(null)
    const triggerRef = useRef(null)
    const sheetRef = useRef(null)
    const listId = useId()

    const q = query.trim()
    const daf = parseDafQuery(q)
    const current = q.length >= 2 && found.q === q ? found : { articles: [], stories: [], failed: false }
    const { articles, stories, failed } = current
    const results = [
        ...(daf ? [{ kind: 'daf', href: dafPath(daf.masechta.name, daf.daf), daf }] : []),
        ...stories.map(s => ({ kind: 'story', href: storyPath(s), item: s })),
        ...articles.map(a => ({ kind: 'article', href: articlePath(a), item: a })),
    ]

    // Search after typing stops
    useEffect(() => {
        if (q.length < 2) return
        let cancelled = false
        const timeoutId = setTimeout(async () => {
            setLoading(true)
            const ts = toTsQuery(q)
            const like = safeLike(q)
            const [a, s] = await Promise.all([
                ts ? supabase.from('articles').select('id, slug, title, masechta, daf, daf_end').textSearch('search_vector', ts).limit(6) : { data: [] },
                like ? supabase.from('stories').select('id, slug, title, masechta, daf, people').or(`title.ilike.%${like}%,summary.ilike.%${like}%`).limit(4) : { data: [] },
            ])
            if (cancelled) return
            setFound({ q, articles: a.data ?? [], stories: s.data ?? [], failed: Boolean(a.error && s.error) })
            setActive(0)
            setLoading(false)
        }, 250)
        return () => { cancelled = true; clearTimeout(timeoutId) }
    }, [q])

    // Log the search once the user stops typing (not every keystroke)
    const lastLogged = useRef('')
    useEffect(() => {
        if (q.length < 2 || loading || q.toLowerCase() === lastLogged.current) return
        const timeoutId = setTimeout(() => {
            lastLogged.current = q.toLowerCase()
            trackSearch({ query: q, results: results.length, path: window.location.pathname }).catch(() => {})
        }, 1500)
        return () => clearTimeout(timeoutId)
    }, [q, loading, results.length])

    // "/" opens search, unless the reader is typing somewhere
    useEffect(() => {
        const onKey = e => {
            const t = e.target
            if (e.key === '/' && !isOpen && !(t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
                e.preventDefault()
                setIsOpen(true)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen])

    // While open: focus the box, and make the page behind unreachable
    useEffect(() => {
        if (!isOpen) return
        inputRef.current?.focus()
        const main = document.getElementById('main')
        main?.setAttribute('inert', '')
        return () => main?.removeAttribute('inert')
    }, [isOpen])

    function close() {
        setIsOpen(false)
        setQuery('')
        requestAnimationFrame(() => triggerRef.current?.focus())
    }

    function choose(result) {
        trackSearchClick({ query: q, target: result.href }).catch(() => {})
        setIsOpen(false)
        setQuery('')
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') { e.preventDefault(); close() }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' && e.target === inputRef.current && results[active]) {
            e.preventDefault()
            choose(results[active])
            router.push(results[active].href)
        } else if (e.key === 'Tab') {
            const focusables = sheetRef.current?.querySelectorAll('a[href], button, input')
            if (!focusables?.length) return
            const first = focusables[0], last = focusables[focusables.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        }
    }

    const optionId = i => `${listId}-o${i}`

    return (
        <>
            <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)} className="btn-quiet" aria-haspopup="dialog">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden sm:block w-[18px] h-[18px] fill-none stroke-current stroke-[1.7]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
                Search
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-50 text-ink" onKeyDown={onKeyDown}>
                    <div className="absolute inset-0 bg-paper/80" onClick={close} aria-hidden="true" />
                    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Search" className="relative bg-paper border-b-[3px] border-double border-rule-hard md:mx-auto md:max-w-[46rem] md:border md:border-t-0 md:border-rule-hard max-h-dvh overflow-y-auto">
                        <div className="px-4 md:px-6 pt-3 pb-5 grid gap-3">
                            <div className="flex items-center gap-2.5 border-b-2 border-ink">
                                <label htmlFor={`${listId}-q`} className="sr-only">Search for a daf, an article or a story</label>
                                <input
                                    id={`${listId}-q`}
                                    ref={inputRef}
                                    type="search"
                                    dir="auto"
                                    autoComplete="off"
                                    placeholder="A daf, a topic or a sage"
                                    className="flex-1 min-w-0 bg-transparent py-3 text-[1.375rem] outline-none placeholder:text-ink-faint"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    role="combobox"
                                    aria-expanded={results.length > 0}
                                    aria-controls={listId}
                                    aria-activedescendant={results[active] ? optionId(active) : undefined}
                                />
                                <button type="button" onClick={close} className="btn-quiet">Close</button>
                            </div>

                            <div id={listId} role="listbox" aria-label="Results" className="grid gap-1">
                                {GROUPS.map(([kind, label]) => {
                                    const items = results.map((r, i) => ({ ...r, i })).filter(r => r.kind === kind)
                                    if (!items.length) return null
                                    return (
                                        <div key={kind} role="group" aria-label={label}>
                                            <div className="sc pt-2">{label}</div>
                                            {items.map(r => {
                                                const num = r.kind === 'daf' ? r.daf.daf : r.item.daf
                                                return (
                                                    <Link
                                                        key={r.href}
                                                        id={optionId(r.i)}
                                                        role="option"
                                                        aria-selected={r.i === active}
                                                        href={r.href}
                                                        onClick={() => choose(r)}
                                                        onMouseEnter={() => setActive(r.i)}
                                                        className={`plain grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 items-baseline px-2 py-2.5 min-h-12 border-b border-rule ${r.i === active ? 'bg-paper-sunk outline outline-1 -outline-offset-1 outline-ink' : ''}`}
                                                    >
                                                        <span lang="he" className="numeral text-[1.4rem] row-span-2" aria-hidden="true">{hebrewNumeral(num)}</span>
                                                        {r.kind === 'daf' ? (
                                                            <>
                                                                <span className="font-semibold">{r.daf.masechta.name} {r.daf.daf}</span>
                                                                <span className="meta">Open this daf</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="font-semibold"><Highlight text={r.item.title} query={q} /></span>
                                                                <span className="meta">
                                                                    {r.kind === 'article' ? articlePlace(r.item) : storyPlace(r.item)}
                                                                    {r.kind === 'story' && r.item.people?.length ? ` · ${r.item.people.join(', ')}` : ''}
                                                                </span>
                                                            </>
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </div>

                            <p className="meta" aria-live="polite">
                                {loading ? 'Searching…'
                                    : failed ? 'Search isn’t available right now. Try again in a moment.'
                                    : q.length >= 2 && results.length === 0 ? `Nothing found for “${q}”.`
                                    : ''}
                            </p>

                            {q.length >= 2 && !loading && results.length === 0 && !failed && (
                                <div className="flex flex-wrap gap-2">
                                    <Link href="/masechtos" className="chip" onClick={() => setIsOpen(false)}>Browse masechtos</Link>
                                    <Link href="/topics" className="chip" onClick={() => setIsOpen(false)}>All topics</Link>
                                    <Link href="/contact" className="chip" onClick={() => setIsOpen(false)}>Write to Rabbi Sebrow</Link>
                                </div>
                            )}

                            <p className="meta hidden md:block">↑ and ↓ to move, Enter to open, Esc to close. Try “Bechoros 23” or “בכורות כג”.</p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}

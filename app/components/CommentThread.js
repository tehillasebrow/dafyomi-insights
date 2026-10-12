'use client'

import { useState, useEffect, useCallback, useId, useSyncExternalStore } from 'react'
import { supabase } from '@/app/lib/supabase'
import { deleteComment, postComment } from '@/app/admin/actions'
import { postingStatus } from '@/app/lib/shas'

const noSubscription = () => () => {}

const SOURCES = {
    article: { table: 'comments', parent: 'article_id' },
    daily: { table: 'daily_comments', parent: 'daily_id' },
}

function when(value) {
    const d = new Date(value)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

// A discussion thread with its form. Shared by articles ("Questions on this article")
// and the daily page ("Today's daf discussion"). Posting closes on Shabbos and Yom Tov.
export default function CommentThread({ kind, parentId, isAdmin = false, title, id = 'discussion', prompt = 'Your question or comment' }) {
    const [comments, setComments] = useState([])
    const [loaded, setLoaded] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [author, setAuthor] = useState('')
    const [content, setContent] = useState('')
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const formId = useId()

    // Shabbos/Yom Tov depends on the reader's clock, so it's read in the browser only.
    // The snapshot is a string so React can compare it between renders.
    const statusKey = useSyncExternalStore(noSubscription, () => JSON.stringify(postingStatus()), () => 'null')
    const parsed = JSON.parse(statusKey)
    const closed = parsed?.closed ? { ...parsed, reopens: new Date(parsed.reopens) } : null

    const load = useCallback(() => {
        const { table, parent } = SOURCES[kind]
        return supabase.from(table).select('*').eq(parent, parentId).order('created_at', { ascending: true })
            .then(({ data, error }) => {
                setLoadError(Boolean(error))
                if (data) setComments(data)
                setLoaded(true)
            })
    }, [kind, parentId])

    useEffect(() => { if (parentId) load() }, [parentId, load])

    async function submit(e) {
        e.preventDefault()
        if (!author.trim() || !content.trim()) {
            setError(!author.trim() ? 'Please add your name.' : 'Please write your comment.')
            return
        }
        setSending(true)
        setError('')
        const result = await postComment(kind, parentId, author, content)
        setSending(false)
        if (result?.error) {
            setError(`Your comment wasn’t posted: ${result.error}. It’s still in the box; try again.`)
            return
        }
        setContent('')
        setNotice('Posted. Thank you.')
        setTimeout(() => setNotice(''), 5000)
        load()
    }

    async function remove(commentId) {
        if (!confirm('Delete this comment?')) return
        const { error } = await deleteComment(kind, commentId)
        if (error) alert(error)
        else load()
    }

    return (
        <section id={id} aria-labelledby={`${formId}-h`} className="grid gap-3.5 scroll-mt-4">
            <h2 id={`${formId}-h`} className="font-semibold text-h2 tracking-[-0.02em]">
                {title}{loaded && !loadError ? ` · ${comments.length}` : ''}
            </h2>

            {loadError && <p className="note" role="alert">The discussion didn’t load. Refresh the page to try again.</p>}
            {loaded && !loadError && comments.length === 0 && <p className="note">No comments yet.</p>}

            <ol className="grid">
                {comments.map(c => (
                    <li key={c.id} className="grid gap-0.5 py-3 border-b border-rule">
                        <div className="flex items-baseline justify-between gap-3">
                            <b className="font-semibold">{c.author_name}</b>
                            <span className="meta">{when(c.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-[1.0625rem]">{c.content}</p>
                        {isAdmin && (
                            <button type="button" onClick={() => remove(c.id)} className="btn-quiet justify-self-start mt-1">Delete comment</button>
                        )}
                    </li>
                ))}
            </ol>

            {closed ? (
                <div className="border border-rule-hard p-4 grid gap-1">
                    <b className="font-semibold text-[1.25rem]">{closed.name}</b>
                    <p className="note">
                        The discussion is closed on {closed.name === 'Shabbos Kodesh' ? 'Shabbos' : 'Yom Tov'}. It reopens{' '}
                        {closed.reopens.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}.
                    </p>
                </div>
            ) : (
                <form onSubmit={submit} className="grid gap-1.5 pt-1.5" noValidate>
                    <label htmlFor={`${formId}-name`} className="text-ui font-semibold mt-1.5">Your name</label>
                    <input id={`${formId}-name`} className="field" value={author} onChange={e => setAuthor(e.target.value)} autoComplete="name" maxLength={100} aria-invalid={error.startsWith('Please add') || undefined} />
                    <label htmlFor={`${formId}-text`} className="text-ui font-semibold mt-1.5">{prompt}</label>
                    <textarea id={`${formId}-text`} className="field" value={content} onChange={e => setContent(e.target.value)} maxLength={5000} aria-invalid={error && !error.startsWith('Please add') ? true : undefined} aria-describedby={error ? `${formId}-err` : undefined} />
                    {error && <p id={`${formId}-err`} role="alert" className="font-semibold text-[0.97rem]">Error: {error}</p>}
                    <p className="note">Shown with your name. Posting is closed on Shabbos and Yom Tov.</p>
                    <div className="flex items-center gap-3 mt-2">
                        <button type="submit" className="btn" disabled={sending}>{sending ? 'Posting…' : 'Post'}</button>
                        <span role="status" className="note">{notice}</span>
                    </div>
                </form>
            )}
        </section>
    )
}

'use client'

import { useCallback, useEffect, useState } from 'react'

// Lights up a story inside the article text instead of leaving the page. Story links
// keep their real /stories/ address (so Google follows them); a link marked
// data-story-highlight is caught here, the story's pieces (ArticleBody's [data-story])
// are highlighted, and a slim bar names the story with a Done button.
// Arriving at the article with #story-slug (from a story page) lights it up too.
export default function StoryHighlighter({ stories = [] }) {
    const [lit, setLit] = useState(null)

    const light = useCallback((slug, scroll) => {
        const first = document.getElementById(slug)
        if (!first) return false
        setLit(slug)
        history.replaceState(history.state, '', `#${encodeURIComponent(slug)}`)
        if (scroll) {
            const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
            first.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })
        }
        first.tabIndex = -1
        first.focus({ preventScroll: true })
        return true
    }, [])

    const done = useCallback(() => {
        setLit(null)
        history.replaceState(history.state, '', location.pathname + location.search)
    }, [])

    useEffect(() => {
        document.querySelectorAll('[data-story]').forEach(el => el.classList.toggle('is-lit', el.dataset.story === lit))
    }, [lit])

    useEffect(() => {
        // After the first paint, so the page has its final layout before scrolling
        const fromHash = () => {
            const slug = decodeURIComponent(location.hash.slice(1))
            if (slug && stories.some(s => s.slug === slug)) light(slug, true)
        }
        const frame = requestAnimationFrame(fromHash)

        function onClick(e) {
            const a = e.target.closest?.('a[data-story-highlight]')
            if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            if (light(a.dataset.storyHighlight, true)) e.preventDefault()
        }
        function onKey(e) { if (e.key === 'Escape') done() }
        document.addEventListener('click', onClick)
        document.addEventListener('keydown', onKey)
        window.addEventListener('hashchange', fromHash)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('hashchange', fromHash)
            document.removeEventListener('click', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [stories, light, done])

    const story = stories.find(s => s.slug === lit)
    if (!story) return null

    return (
        <div className="story-bar" role="region" aria-label="Highlighted story" data-no-print>
            <div className="folio flex items-center justify-between gap-3">
                <p className="min-w-0">
                    <span className="sc block">Story in this article</span>
                    <b className="font-semibold leading-tight">{story.title}</b>
                </p>
                <button type="button" className="btn-quiet shrink-0" onClick={done}>Done</button>
            </div>
        </div>
    )
}

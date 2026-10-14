import { isMostlyHebrew } from '@/app/lib/shas'

// The article text, split into paragraphs at blank lines. Each story inside it keeps an
// <span id={slug}> anchor so links (and Google's "jump to") can land on it; a story that
// runs across paragraphs is wrapped piece by piece, with the id on its first piece.
// Offsets are only a hint: if the article was edited, the story is found by its text,
// and if it's gone the text simply renders without an anchor. Every piece carries
// data-story so StoryHighlighter can light the whole story up.
export function locate(content, story) {
    const { start_offset: start, end_offset: end } = story
    if (Number.isInteger(start) && Number.isInteger(end) && content.slice(start, end) === story.content) {
        return { start, end }
    }
    const found = story.content ? content.indexOf(story.content) : -1
    return found === -1 ? null : { start: found, end: found + story.content.length }
}

export function paragraphs(content) {
    const out = []
    const re = /\n[ \t]*\n+/g
    let last = 0
    for (let m; (m = re.exec(content)); ) {
        if (m.index > last) out.push([last, m.index])
        last = m.index + m[0].length
    }
    if (last < content.length) out.push([last, content.length])
    return out.filter(([s, e]) => content.slice(s, e).trim())
}

export default function ArticleBody({ content = '', stories = [] }) {
    const spans = []
    for (const story of stories) {
        const at = locate(content, story)
        if (!at) continue
        if (spans.some(s => at.start < s.end && at.end > s.start)) continue // overlapping stories: keep the first
        spans.push({ story, ...at })
    }
    spans.sort((a, b) => a.start - b.start)

    return (
        <div className="daf-text prose">
            {paragraphs(content).map(([ps, pe]) => {
                const text = content.slice(ps, pe)
                // A paragraph starting with "## " is a subheading, as the newspaper printed them
                const heading = text.match(/^\s*##\s+(.+)$/s)
                if (heading) {
                    const title = heading[1].trim()
                    const hebrew = isMostlyHebrew(title)
                    return <h2 key={ps} dir={hebrew ? 'rtl' : 'auto'} lang={hebrew ? 'he' : undefined}>{title}</h2>
                }
                const parts = []
                let cursor = ps
                for (const { story, start, end } of spans) {
                    if (end <= ps || start >= pe) continue
                    const s = Math.max(start, ps), e = Math.min(end, pe)
                    if (s > cursor) parts.push(content.slice(cursor, s))
                    parts.push(<span key={`${story.id}-${s}`} id={s === start ? story.slug : undefined} data-story={story.slug}>{content.slice(s, e)}</span>)
                    cursor = e
                }
                if (cursor < pe) parts.push(content.slice(cursor, pe))
                const hebrew = isMostlyHebrew(text)
                return <p key={ps} dir={hebrew ? 'rtl' : 'auto'} lang={hebrew ? 'he' : undefined}>{parts}</p>
            })}
        </div>
    )
}

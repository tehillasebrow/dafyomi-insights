// The links area at the foot of an article or story page: the stories in this
// article, more stories about the same sage, and more in the masechta.
// On an article it is folded shut: the stories are there for Google and for anyone
// who looks, without pulling readers away from the article. A story in this article
// is lit up in place (StoryHighlighter) rather than opened on its own page.
import Link from 'next/link'
import { storyPath, personPath, storyPlace, getStoriesAbout, getStoriesInMasechta } from '@/app/lib/stories'
import { slugify } from '@/app/lib/articles'
import StoryRow from './StoryRow'
import StoryHighlighter from './StoryHighlighter'
import { hebrewNumeral } from '@/app/lib/shas'

// The sage who appears in the most of these stories
function mainPerson(stories) {
    const counts = new Map()
    for (const s of stories) for (const p of s.people ?? []) counts.set(p, (counts.get(p) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function Group({ title, href, linkLabel, stories, children }) {
    if (!stories.length) return null
    return (
        <section className="grid">
            <div className="flex items-baseline justify-between gap-3 border-b border-rule-hard pb-2">
                <h2 className="font-semibold text-h2 tracking-[-0.02em]">{title}</h2>
                {href && <Link href={href} className="tap shrink-0">{linkLabel}</Link>}
            </div>
            {children ?? stories.map(s => <StoryRow key={s.id} story={s} showSummary={false} />)}
        </section>
    )
}

// stories: the stories in this article (or, on a story page, the story itself)
export default async function RelatedStories({ masechta, stories = [], showOwn = true, folded = false, ownTitle = 'Stories in this article' }) {
    const ownIds = stories.map(s => s.id)
    const person = mainPerson(stories)

    const [aboutPerson, inMasechta] = await Promise.all([
        person ? getStoriesAbout(person, { excludeIds: ownIds, limit: 4 }) : [],
        masechta ? getStoriesInMasechta(masechta, { excludeIds: ownIds, limit: 4 }) : [],
    ])
    const shown = new Set(aboutPerson.map(s => s.id))
    const moreInMasechta = inMasechta.filter(s => !shown.has(s.id))

    if (!(showOwn && stories.length) && !aboutPerson.length && !moreInMasechta.length) return null

    const groups = (
        <div className="grid gap-8" aria-label="Related Gemara stories">
            {showOwn && (
                <Group title={ownTitle} stories={stories}>
                    <ol className="grid">
                        {stories.map((s, i) => (
                            <li key={s.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2.5 py-2.5 border-b border-rule items-baseline">
                                <span lang="he" className="numeral text-[1.25rem] text-foil-ink" aria-hidden="true">{hebrewNumeral(i + 1, { punctuate: false })}</span>
                                <span>
                                    {folded
                                        ? <a href={storyPath(s)} data-story-highlight={s.slug} className="font-semibold">{s.title}</a>
                                        : <a href={`#${s.slug}`} className="font-semibold">{s.title}</a>}
                                    <span className="meta block">{storyPlace(s)}{!folded && <> · <Link href={storyPath(s)}>Read on its own</Link></>}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </Group>
            )}
            {person && <Group title={`More about ${person}`} href={personPath(person)} linkLabel="All stories" stories={aboutPerson} />}
            {masechta && <Group title={`More stories in ${masechta}`} href={`/stories#${slugify(masechta)}`} linkLabel="All in this masechta" stories={moreInMasechta} />}
        </div>
    )
    if (!folded) return groups

    const count = showOwn ? stories.length : 0
    return (
        <>
            <details className="story-fold" data-no-print>
                <summary>{count ? `${ownTitle} (${count})` : 'More Gemara stories'}</summary>
                <div className="pt-2 pb-5">{groups}</div>
            </details>
            {count > 0 && <StoryHighlighter stories={stories.map(s => ({ slug: s.slug, title: s.title }))} />}
        </>
    )
}

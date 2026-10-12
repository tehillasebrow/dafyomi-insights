import Link from 'next/link'
import { storyPath, personPath } from '@/app/lib/stories'
import { hebrewNumeral } from '@/app/lib/shas'

// One Gemara story in a list, in the same pattern as ArticleRow, with the sages named.
export default function StoryRow({ story, showMasechta = true, showSummary = true, headingLevel = 3 }) {
    const Heading = `h${headingLevel}`
    return (
        <article className="row row-wide">
            <span lang="he" className="numeral row-num" aria-hidden="true">{hebrewNumeral(story.daf)}</span>
            <Heading className="row-title"><Link href={storyPath(story)}>{story.title}</Link></Heading>
            {showSummary && story.summary && <p className="row-text">{story.summary}</p>}
            {story.people?.length > 0 && (
                <p className="meta">
                    {story.people.map((name, i) => (
                        <span key={name}>{i > 0 && ', '}<Link href={personPath(name)}>{name}</Link></span>
                    ))}
                </p>
            )}
            <p className="meta row-side">{showMasechta ? `${story.masechta} ${story.daf}` : `Daf ${story.daf}`}</p>
        </article>
    )
}

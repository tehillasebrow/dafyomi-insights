import Link from 'next/link'
import { storyPath, personPath, storyPlace } from '@/app/lib/stories'
import { hebrewNumeral } from '@/app/lib/shas'

// One Gemara story as an index card, for the /stories grid: where it is, its title,
// a short summary and the people in it.
export default function StoryTile({ story, showMasechta = true }) {
    return (
        <article className="index-card p-5 grid gap-2 content-start min-w-0">
            <p className="meta flex items-center gap-2">
                {story.masechta && <span lang="he" aria-hidden="true" className="numeral bg-foil text-[#17181c] text-[1.05rem] px-1.5 pt-0.5 rounded-[3px]">{hebrewNumeral(story.daf)}</span>}
                {showMasechta || !story.masechta ? storyPlace(story) : `Daf ${story.daf}`}
            </p>
            <h3 className="text-[1.25rem] leading-tight"><Link href={storyPath(story)} className="topic-name text-[inherit]">{story.title}</Link></h3>
            {story.summary && <p className="note line-clamp-3">{story.summary}</p>}
            {story.people?.length > 0 && (
                <p className="meta">
                    {story.people.map((name, i) => (
                        <span key={name}>{i > 0 && ', '}<Link href={personPath(name)}>{name}</Link></span>
                    ))}
                </p>
            )}
        </article>
    )
}

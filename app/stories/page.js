import Link from 'next/link'
import { slugify, BEYOND_THE_DAF } from '@/app/lib/articles'
import { MASECHTOS, findMasechta, todayInNewYork, weekOfDafim } from '@/app/lib/shas'
import { buildMetadata, collectionJsonLd } from '@/app/lib/seo'
import { getAllStories, storyPath, storyPlace } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import StoryRow from '@/app/components/StoryRow'
import StoryGroupSwitch from '@/app/components/StoryGroupSwitch'

export const revalidate = 3600

const DESCRIPTION = 'Every Gemara story from the Daf Yomi, masechta by masechta: the stories of Rabbi Akiva, Hillel and Shammai, Choni HaMe’agel and more, each explained by Rabbi Avrohom Sebrow.'

export const metadata = buildMetadata({
    title: 'Gemara Stories: Every Aggadah Story in the Daf Yomi',
    description: DESCRIPTION,
    path: '/stories',
})

// Shas order, with any unrecognised masechta names at the end, then the stories
// from articles that aren't on a daf (Beyond the Daf, id "beyond-the-daf")
const ORDER = new Map(MASECHTOS.map((m, i) => [m.name.toLowerCase(), i]))

export default async function StoriesPage() {
    const stories = await getAllStories()

    const groups = new Map()
    for (const s of stories) {
        const key = s.masechta || BEYOND_THE_DAF
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(s)
    }
    const rank = m => m === BEYOND_THE_DAF ? 1000 : ORDER.get(m.toLowerCase()) ?? 999
    const masechtos = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

    // Stories on this week's dafim come first. (Hourly cache: close enough for a weekly list.)
    const week = weekOfDafim(todayInNewYork())
    const thisWeek = stories.filter(s => week.some(d => findMasechta(s.masechta)?.name === d.masechta.name && s.daf === d.daf))

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={collectionJsonLd({
                name: 'Gemara Stories',
                description: DESCRIPTION,
                path: '/stories',
                items: stories.map(s => ({ name: `${s.title} (${storyPlace(s)})`, path: storyPath(s) })),
            })} />

            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Gemara stories</h1>
                <p className="text-lede text-ink-soft max-w-[58ch]">The aggadah of the Daf, story by story, from Rabbi Sebrow’s articles. {stories.length > 0 && `${stories.length} stories so far.`}</p>
            </header>

            <div className="flex flex-wrap items-center gap-2 py-3.5 border-b border-rule">
                <StoryGroupSwitch current="masechta" />
                {masechtos.length > 1 && (
                    <nav aria-label="Jump to masechta" className="flex flex-wrap gap-1.5">
                        {masechtos.map(m => <a key={m} href={`#${slugify(m)}`} className="chip">{m}</a>)}
                    </nav>
                )}
            </div>

            {stories.length === 0 && (
                <p className="text-ink-soft py-6">Stories are being added. In the meantime, <Link href="/articles">read the articles</Link>.</p>
            )}

            {thisWeek.length > 0 && (
                <section aria-labelledby="week-h" className="pt-6">
                    <h2 id="week-h" className="sc">On this week’s dafim</h2>
                    {thisWeek.map(s => <StoryRow key={s.id} story={s} />)}
                </section>
            )}

            {masechtos.map(m => (
                <section key={m} id={slugify(m)} aria-labelledby={`${slugify(m)}-h`} className="pt-6 scroll-mt-4">
                    <h2 id={`${slugify(m)}-h`} className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2">{m}</h2>
                    {groups.get(m).map(s => <StoryRow key={s.id} story={s} showMasechta={false} />)}
                </section>
            ))}
        </div>
    )
}

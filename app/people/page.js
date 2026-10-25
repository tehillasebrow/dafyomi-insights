import Link from 'next/link'
import { buildMetadata, collectionJsonLd } from '@/app/lib/seo'
import { getAllStories, storyPath, personPath } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import StoryGroupSwitch from '@/app/components/StoryGroupSwitch'

export const revalidate = 3600

const DESCRIPTION = 'Gemara stories about the Tannaim and Amoraim — Rabbi Akiva, Hillel, Rabbi Yochanan ben Zakkai, Reish Lakish and more — from the Daf Yomi, by Rabbi Avrohom Sebrow.'

export const metadata = buildMetadata({
    title: 'Stories of the Sages of the Talmud',
    description: DESCRIPTION,
    path: '/people',
})

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
// "Rabbi Akiva" is filed under A
const TITLES = /^(rabbi|rabban|rav|r'|rebbi|reb)s+/i
const SHOWN = 3

export default async function PeoplePage() {
    // Each person with the stories they appear in, filed A to Z
    const stories = await getAllStories('slug, title, people')
    const byName = new Map()
    for (const s of stories) {
        for (const raw of s.people ?? []) {
            const name = raw?.trim()
            if (!name) continue
            if (!byName.has(name)) byName.set(name, [])
            byName.get(name).push(s)
        }
    }
    const key = name => name.replace(TITLES, '').trim()
    const people = [...byName].map(([name, list]) => ({ name, stories: list, count: list.length }))
        .sort((a, b) => key(a.name).localeCompare(key(b.name)))
    const letters = new Map()
    for (const p of people) {
        const first = key(p.name)[0]?.toUpperCase()
        const letter = LETTERS.includes(first) ? first : '#'
        if (!letters.has(letter)) letters.set(letter, [])
        letters.get(letter).push(p)
    }

    return (
        <div className="folio py-6 md:py-8">
            <JsonLd data={collectionJsonLd({
                name: 'Stories of the Sages of the Talmud',
                description: DESCRIPTION,
                path: '/people',
                items: people.map(p => ({ name: `Stories about ${p.name}`, path: personPath(p.name) })),
            })} />

            <nav aria-label="Breadcrumb" className="crumbs"><Link href="/stories">Stories</Link></nav>
            <header className="grid gap-2 pb-4 border-b border-rule-hard">
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Stories by person</h1>
            </header>
            <div className="py-3.5"><StoryGroupSwitch current="sage" /></div>

            {people.length === 0 ? (
                <p className="text-ink-soft py-4">Stories are being added. <Link href="/stories">See all Gemara stories</Link>.</p>
            ) : (
                <>
                    <nav aria-label="Jump to letter" className="flex flex-wrap gap-1 py-2.5 border-b border-rule">
                        {LETTERS.map(l => letters.has(l)
                            ? <a key={l} href={`#person-${l}`} className="chip justify-center min-w-11 px-0 bg-surface hover:bg-mark">{l}</a>
                            : <span key={l} aria-disabled="true" className="min-w-11 min-h-11 grid place-items-center text-ink-faint">{l}</span>)}
                    </nav>
                    {[...letters].map(([letter, list]) => (
                        <section key={letter} id={`person-${letter}`} aria-labelledby={`person-${letter}-h`} className="pt-7 scroll-mt-4">
                            <h2 id={`person-${letter}-h`} className="font-semibold text-h2 tracking-[-0.02em] border-b border-rule-hard pb-2"><span className="hl">{letter}</span></h2>
                            <ul className="grid gap-3.5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                                {list.map(p => (
                                    <li key={p.name} className="index-card p-5 grid gap-2.5 content-start min-w-0">
                                        <div className="grid gap-0.5">
                                            <Link href={personPath(p.name)} className="topic-name">{p.name}</Link>
                                            <span className="meta">{p.count} {p.count === 1 ? 'story' : 'stories'}</span>
                                        </div>
                                        <ul className="topic-subs">
                                            {p.stories.slice(0, SHOWN).map(s => <li key={s.slug}><Link href={storyPath(s)}>{s.title}</Link></li>)}
                                        </ul>
                                        {p.count > SHOWN && <Link href={personPath(p.name)} className="kicker no-underline hover:underline">All {p.count} stories →</Link>}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </>
            )}
        </div>
    )
}

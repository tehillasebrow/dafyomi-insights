import Link from 'next/link'
import { buildMetadata, collectionJsonLd } from '@/app/lib/seo'
import { getAllPeople, personPath } from '@/app/lib/stories'
import JsonLd from '@/app/components/JsonLd'
import AlphaIndex from '@/app/components/AlphaIndex'
import StoryGroupSwitch from '@/app/components/StoryGroupSwitch'

export const revalidate = 3600

const DESCRIPTION = 'Gemara stories about the Tannaim and Amoraim — Rabbi Akiva, Hillel, Rabbi Yochanan ben Zakkai, Reish Lakish and more — from the Daf Yomi, by Rabbi Avrohom Sebrow.'

export const metadata = buildMetadata({
    title: 'Stories of the Sages of the Talmud',
    description: DESCRIPTION,
    path: '/people',
})

export default async function PeoplePage() {
    const people = await getAllPeople()

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
                <h1 className="font-semibold text-[clamp(2.25rem,6vw,3.75rem)] leading-none tracking-[-0.02em]">Stories by sage</h1>
                <p className="text-lede text-ink-soft max-w-[58ch]">The Tannaim and Amoraim who appear in the Gemara’s stories, filed by name.</p>
            </header>
            <div className="py-3.5"><StoryGroupSwitch current="sage" /></div>

            {people.length === 0 ? (
                <p className="text-ink-soft py-4">Stories are being added. <Link href="/stories">See all Gemara stories</Link>.</p>
            ) : (
                <AlphaIndex
                    ignoreTitles
                    idPrefix="sage"
                    entries={people.map(p => ({ label: p.name, href: personPath(p.name), note: `${p.count} ${p.count === 1 ? 'story' : 'stories'}` }))}
                />
            )}
        </div>
    )
}

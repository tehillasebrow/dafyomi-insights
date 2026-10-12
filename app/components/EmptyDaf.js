import Link from 'next/link'
import { articlePath, dafLabel } from '@/app/lib/articles'
import { masechtaHref } from '@/app/lib/shas'

// An empty daf: margins printed, the centre blank. Used for a daf with no article
// yet, and for pages that don't exist.
export function EmptyDafPicture() {
    return (
        <div aria-hidden="true" className="w-full max-w-[15rem] aspect-[4/5] grid grid-cols-[1fr_2.2fr_1fr] gap-2 p-2.5 border border-rule">
            <i className="bg-[repeating-linear-gradient(to_bottom,var(--rule)_0_1px,transparent_1px_9px)]" />
            <i className="border border-dashed border-field" />
            <i className="bg-[repeating-linear-gradient(to_bottom,var(--rule)_0_1px,transparent_1px_9px)]" />
        </div>
    )
}

export default function EmptyDaf({ masechta, daf, nearest }) {
    return (
        <div className="folio py-8 md:py-14 grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-x-11 md:items-center">
            <EmptyDafPicture />
            <div>
                <p className="sc">{masechta.name} {daf}</p>
                <h1 className="font-semibold text-[clamp(2rem,5vw,3.1rem)] leading-[1.02] tracking-[-0.02em]">There’s no article on {masechta.name} {daf} yet</h1>
                {nearest ? (
                    <p className="text-lede text-ink-soft max-w-[46ch] mt-2.5 mb-4">
                        The nearest is “{nearest.title}” on {nearest.masechta} {dafLabel(nearest)}.
                    </p>
                ) : (
                    <p className="text-lede text-ink-soft max-w-[46ch] mt-2.5 mb-4">There are no articles on {masechta.name} yet.</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {nearest && <Link href={articlePath(nearest)} className="btn">Read it</Link>}
                    <Link href={masechtaHref(masechta.name)} className="btn-quiet">All of {masechta.name}</Link>
                    <Link href="/articles" className="btn-quiet">All articles</Link>
                </div>
            </div>
        </div>
    )
}

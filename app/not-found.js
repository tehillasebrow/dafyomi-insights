import Link from 'next/link'
import { EmptyDafPicture } from './components/EmptyDaf'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
    return (
        <div className="folio py-8 md:py-14 grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-x-11 md:items-center">
            <EmptyDafPicture />
            <div>
                <p className="sc">Page not found</p>
                <h1 className="font-semibold text-[clamp(2rem,5vw,3.1rem)] leading-[1.02] tracking-[-0.02em]">This page isn’t in the book</h1>
                <p className="text-lede text-ink-soft max-w-[46ch] mt-2.5 mb-4">The link may be old, or the address mistyped. Try today’s daf, or search for what you were looking for.</p>
                <div className="flex flex-wrap gap-2">
                    <Link href="/daily" className="btn">Today’s daf</Link>
                    <Link href="/articles" className="btn-quiet">All articles</Link>
                    <Link href="/masechtos" className="btn-quiet">Masechtos</Link>
                </div>
            </div>
        </div>
    )
}

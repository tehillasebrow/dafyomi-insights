'use client'

import Link from 'next/link'

export default function Error({ reset }) {
    return (
        <div className="folio py-10 md:py-16">
            <div className="border border-rule-hard p-5 grid gap-3 max-w-[40rem]" role="alert">
                <h1 className="font-semibold text-[1.75rem] leading-tight">This page didn’t load</h1>
                <p className="text-ink-soft text-[1.06rem]">Something went wrong while loading it, possibly a dropped connection. Try again; if it keeps happening, come back in a few minutes.</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn" onClick={() => reset()}>Try again</button>
                    <Link href="/" className="btn-quiet">Home</Link>
                </div>
            </div>
        </div>
    )
}

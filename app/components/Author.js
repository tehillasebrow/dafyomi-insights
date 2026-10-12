import Image from 'next/image'
import Link from 'next/link'
import { AUTHOR } from '@/app/lib/site'

// The author's portrait, framed like a printed plate. Until a photo is set in
// lib/site.js, his Hebrew initials stand in.
export function AuthorPlate({ size = 'md' }) {
    const sizes = {
        sm: 'w-11 h-[3.4rem] text-[1.05rem] outline-offset-[-4px]',
        md: 'w-[4.5rem] h-[5.5rem] text-[1.6rem] outline-offset-[-5px]',
        lg: 'w-full max-w-[13rem] aspect-[4/5] text-[4rem] outline-offset-[-8px]',
    }
    const frame = `relative shrink-0 grid place-items-center overflow-hidden border border-foil-ink outline outline-1 outline-foil-ink bg-paper-sunk text-foil-ink ${sizes[size]}`
    if (AUTHOR.photo) {
        return (
            <span className={frame}>
                <Image src={AUTHOR.photo} alt={AUTHOR.name} fill sizes={size === 'lg' ? '208px' : '72px'} className="object-cover" />
            </span>
        )
    }
    return <span lang="he" aria-hidden="true" className={`${frame} numeral`}>{AUTHOR.hebrewInitials}</span>
}

export function Byline() {
    return (
        <div className="flex items-center gap-3">
            <AuthorPlate size="sm" />
            <div>
                <Link href="/contact" className="plain font-semibold block">{AUTHOR.name}</Link>
                <span className="meta">{AUTHOR.column}</span>
            </div>
        </div>
    )
}

export function AuthorStrip() {
    return (
        <section aria-labelledby="author-h" className="rule-double pt-6 flex gap-4.5 items-start">
            <AuthorPlate />
            <div>
                <h2 id="author-h" className="font-semibold text-[1.375rem]">{AUTHOR.name}</h2>
                <p className="text-ink-soft text-[1.0625rem] mt-1 mb-1.5 max-w-[64ch]">{AUTHOR.bio}</p>
                <Link href="/contact" className="tap">About and contact</Link>
            </div>
        </section>
    )
}

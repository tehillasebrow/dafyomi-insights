import Image from 'next/image'
import { findMasechta, hebrewNumeral } from '@/app/lib/shas'

// Article photos. Images in Supabase storage go through Next's optimizer; images
// imported from other sites are shown as they are, since their hosts aren't known.
const OPTIMIZABLE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//

// The whole picture, never chopped: a tall or very wide picture sits inside the frame,
// and a soft blurred copy of itself fills the space around it. Both use the same
// optimized file, so the browser downloads it once.
function FittedPhoto({ src, alt, sizes, priority }) {
    const unoptimized = !OPTIMIZABLE.test(src)
    return (
        <>
            <Image src={src} alt="" aria-hidden="true" fill sizes={sizes} priority={priority} unoptimized={unoptimized} className="photo-fill" />
            <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} className="object-contain" />
        </>
    )
}

// The article page's picture, in its own shape (a cartoon's caption and speech bubbles
// are never cut off). A very tall picture is held to most of the screen's height.
// Clicking it opens the full-size file, for reading small print in a cartoon.
export default function ArticleImage({ src, alt = '', credit, priority = false, sizes = '(min-width: 1024px) 720px, 100vw', className = '' }) {
    if (!src) return null
    return (
        <figure className={className}>
            <a href={src} target="_blank" rel="noopener" className="block bg-paper-sunk" aria-label="Open the picture full size">
                {/* width/height only reserve space until the picture loads; it then keeps its own shape */}
                <Image
                    src={src}
                    alt={alt}
                    width={1600}
                    height={1067}
                    sizes={sizes}
                    priority={priority}
                    unoptimized={!OPTIMIZABLE.test(src)}
                    className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full"
                />
            </a>
            {credit && <PhotoCredit credit={credit} />}
        </figure>
    )
}

// Credit line for a free-license photo: { author, license, license_url, source_url }
function PhotoCredit({ credit }) {
    const { author, license, license_url, source_url } = credit
    return (
        <figcaption className="mt-1.5 text-xs text-ink-faint">
            Photo
            {author && <>: {source_url ? <a href={source_url} rel="nofollow noopener" target="_blank">{author}</a> : author}</>}
            {license && <>{' · '}{license_url ? <a href={license_url} rel="license nofollow noopener" target="_blank">{license}</a> : license}</>}
        </figcaption>
    )
}

// An article's picture for lists and cards. With no picture, its daf is stamped in gold
// on the black binding, so every article still has a face. An article that isn't on a
// daf (Beyond the Daf) gets the word כתבים ("writings") instead.
export function ArticleThumb({ article, sizes = '12rem', priority = false, className = '' }) {
    const masechta = findMasechta(article.masechta)
    const standalone = !article.masechta
    return (
        <div className={`plate ${className}`} aria-hidden="true">
            {article.image_url ? (
                <FittedPhoto src={article.image_url} alt="" sizes={sizes} priority={priority} />
            ) : standalone ? (
                <span lang="he" className="plate-num" style={{ fontSize: 'clamp(1.25rem, 22cqi, 4rem)' }}>כתבים</span>
            ) : (
                <>
                    <span lang="he" className="plate-num">{hebrewNumeral(article.daf)}</span>
                    {masechta && <span lang="he" className="plate-name">{masechta.hebrew}</span>}
                </>
            )}
        </div>
    )
}

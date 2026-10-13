import Image from 'next/image'
import { findMasechta, hebrewNumeral } from '@/app/lib/shas'

// Article photos. Images in Supabase storage go through Next's optimizer; images
// imported from other sites are shown as they are, since their hosts aren't known.
const OPTIMIZABLE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//

export default function ArticleImage({ src, alt = '', priority = false, sizes = '(min-width: 1024px) 720px, 100vw', className = '' }) {
    if (!src) return null
    return (
        <div className={`relative aspect-[3/2] w-full overflow-hidden bg-paper-sunk ${className}`}>
            <Image
                src={src}
                alt={alt}
                fill
                sizes={sizes}
                priority={priority}
                unoptimized={!OPTIMIZABLE.test(src)}
                className="object-cover"
            />
        </div>
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
                <Image src={article.image_url} alt="" fill sizes={sizes} priority={priority} unoptimized={!OPTIMIZABLE.test(article.image_url)} className="object-cover" />
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

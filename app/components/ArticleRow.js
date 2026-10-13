import Link from 'next/link'
import { articlePath, articleOpening, articlePlace, dafLabel, formatArticleDate, isStandalone, readingMinutes } from '@/app/lib/articles'
import { ArticleThumb } from './ArticleImage'

// One article in a list: its picture (or its daf stamped on the binding), title,
// the article's opening lines, and where/when.
export default function ArticleRow({ article, showMasechta = true, headingLevel = 3 }) {
    const Heading = `h${headingLevel}`
    const where = showMasechta || isStandalone(article) ? articlePlace(article) : `Daf ${dafLabel(article)}`
    return (
        <article className="row row-pic">
            <ArticleThumb article={article} className="row-num" sizes="(min-width: 768px) 11rem, 6.5rem" />
            <p className="meta">
                {where}
                <span aria-hidden="true"> · </span>
                <time dateTime={new Date(article.published_at || article.created_at).toISOString()}>{formatArticleDate(article, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                {article.content && <><span aria-hidden="true"> · </span>{readingMinutes(article)} min</>}
            </p>
            <Heading className="row-title"><Link href={articlePath(article)}>{article.title}</Link></Heading>
            <p className="row-text">{articleOpening(article, 220)}</p>
        </article>
    )
}

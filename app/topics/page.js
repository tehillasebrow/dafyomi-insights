import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { Tag, Hash } from 'lucide-react'

export const revalidate = 0

export const metadata = {
    title: 'Topics & Categories for Daf Yomi Articles | Daf Yomi Insights',
    description: 'Browse Daf Yomi articles sorted by topic.',
}

export default async function TopicsPage() {
    // 1. Fetch ONLY the tags from every article
    const { data: articles } = await supabase
        .from('articles')
        .select('tags')

    // 2. Magic JavaScript to calculate counts
    // This turns [["Halacha", "Shabbos"], ["Halacha", "Yoma"]] into { Halacha: 2, Shabbos: 1, Yoma: 1 }
    const tagCounts = {}

    articles?.forEach(article => {
        if (article.tags) {
            article.tags.forEach(tag => {
                const cleanTag = tag.trim()
                if (cleanTag) {
                    tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1
                }
            })
        }
    })

    // 3. Sort them alphabetically
    const sortedTags = Object.keys(tagCounts).sort()

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                <Hash className="w-8 h-8 text-blue-600" />
                Browse by Topic
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {sortedTags.map((tag) => (
                    <Link
                        key={tag}
                        href={`/topics/${tag}`} // This links to the dynamic page below
                        className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition"
                    >
            <span className="flex items-center gap-2 font-medium text-slate-700 group-hover:text-blue-700">
              <Tag className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                {tag}
            </span>
                        <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600">
              {tagCounts[tag]}
            </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
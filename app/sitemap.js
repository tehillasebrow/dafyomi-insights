import { supabase } from '@/app/lib/supabase'

export default async function sitemap() {
    const baseUrl = 'https://dafyomiinsights.com'

    // 1. Fetch all articles from DB
    const { data: articles } = await supabase
        .from('articles')
        .select('masechta, daf, created_at')

    // 2. Generate a URL for every single article
    const articleUrls = articles?.map((article) => ({
        url: `${baseUrl}/daf/${article.masechta.toLowerCase()}/${article.daf}`,
        lastModified: new Date(article.created_at),
        changeFrequency: 'monthly',
        priority: 0.8,
    })) ?? []

    // 3. Add the static pages (Homepage, etc.)
    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        ...articleUrls,
    ]
}
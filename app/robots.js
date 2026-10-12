import { SITE_URL } from '@/app/lib/site'

// AI search and assistant crawlers, named explicitly so the site can be found
// and cited in ChatGPT, Claude, Perplexity, Google AI Overviews, Apple, etc.
const AI_CRAWLERS = [
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
    'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
    'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent',
]

export default function robots() {
    return {
        rules: [
            { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
            { userAgent: AI_CRAWLERS, allow: '/', disallow: ['/admin', '/api/'] },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    }
}

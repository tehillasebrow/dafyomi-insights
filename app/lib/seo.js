// lib/seo.js
// Page metadata (title, canonical, Open Graph, Twitter) and schema.org JSON-LD
// builders. Every page builds its metadata through buildMetadata, because Next
// replaces (not merges) the layout's openGraph/twitter when a page sets them.
import { SITE_URL, SITE_NAME, AUTHOR, DEFAULT_DESCRIPTION } from '@/app/lib/site'

export const DEFAULT_OG_IMAGE = '/opengraph-image'

export function absoluteUrl(path = '/') {
    return new URL(path, SITE_URL).toString()
}

// title: the page part only; the layout's template adds " | Daf Yomi Insights".
// absoluteTitle: a full title that skips the template (home page).
export function buildMetadata({
    title,
    absoluteTitle,
    description = DEFAULT_DESCRIPTION,
    path,
    type = 'website',
    image,
    publishedTime,
    modifiedTime,
    tags,
    keywords,
}) {
    const fullTitle = absoluteTitle ?? (title ? `${title} | ${SITE_NAME}` : SITE_NAME)
    const images = [image || DEFAULT_OG_IMAGE]

    const openGraph = {
        type,
        siteName: SITE_NAME,
        locale: 'en_US',
        url: path,
        title: fullTitle,
        description,
        images,
    }
    if (type === 'article') {
        openGraph.authors = [AUTHOR.name]
        if (publishedTime) openGraph.publishedTime = new Date(publishedTime).toISOString()
        if (modifiedTime) openGraph.modifiedTime = new Date(modifiedTime).toISOString()
        if (tags?.length) openGraph.tags = tags
    }

    return {
        title: absoluteTitle ? { absolute: absoluteTitle } : title,
        description,
        ...(keywords?.length && { keywords }),
        alternates: { canonical: path },
        openGraph,
        twitter: { card: 'summary_large_image', title: fullTitle, description, images },
    }
}

// Trim text to a meta-description length, on a word boundary
export function clip(text = '', max = 160) {
    const clean = String(text).replace(/\s+/g, ' ').trim()
    if (clean.length <= max) return clean
    return clean.slice(0, clean.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…'
}

// --- JSON-LD -----------------------------------------------------------------

export const AUTHOR_ID = `${SITE_URL}/#author`
export const WEBSITE_ID = `${SITE_URL}/#website`

export function authorJsonLd() {
    return {
        '@type': 'Person',
        '@id': AUTHOR_ID,
        name: AUTHOR.name,
        url: absoluteUrl('/contact'),
        description: AUTHOR.bio,
        ...(AUTHOR.photo && { image: absoluteUrl(AUTHOR.photo) }),
    }
}

export function websiteJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': WEBSITE_ID,
                url: SITE_URL,
                name: SITE_NAME,
                description: DEFAULT_DESCRIPTION,
                inLanguage: 'en',
                author: { '@id': AUTHOR_ID },
                publisher: { '@id': AUTHOR_ID },
            },
            authorJsonLd(),
        ],
    }
}

// items: [{ name, path }], ending with the current page
export function breadcrumbJsonLd(items) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: absoluteUrl(item.path),
        })),
    }
}

// A list page (masechta, topic, person, all stories): items are [{ name, path }]
export function collectionJsonLd({ name, description, path, items }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        description,
        url: absoluteUrl(path),
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: items.length,
            itemListElement: items.map((item, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: item.name,
                url: absoluteUrl(item.path),
            })),
        },
    }
}

// The masechta and daf an article or story discusses
export function talmudSourceJsonLd(masechta, dafLabel) {
    return {
        '@type': 'CreativeWork',
        name: `Talmud Bavli, ${masechta} ${dafLabel}`,
        alternateName: `Gemara ${masechta} ${dafLabel}`,
    }
}

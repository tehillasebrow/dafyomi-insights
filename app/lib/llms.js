// lib/llms.js
// Builds /llms.txt (a Markdown map of the site for AI assistants, per llmstxt.org)
// and /llms-full.txt (the full text of every article and story).
import { supabase } from '@/app/lib/supabase'
import { SITE_URL, SITE_NAME, AUTHOR, DEFAULT_DESCRIPTION } from '@/app/lib/site'
import { MASECHTOS, masechtaHref } from '@/app/lib/shas'
import { articlePath, dafLabel, orderByPublished } from '@/app/lib/articles'
import { getAllStories, storyPath, personPath, getAllPeople } from '@/app/lib/stories'

const url = path => `${SITE_URL}${path}`
const ORDER = new Map(MASECHTOS.map((m, i) => [m.name.toLowerCase(), i]))
const byShas = (a, b) =>
    (ORDER.get(a.masechta.toLowerCase()) ?? 999) - (ORDER.get(b.masechta.toLowerCase()) ?? 999)
    || a.masechta.localeCompare(b.masechta)
    || a.daf - b.daf
const oneLine = text => String(text ?? '').replace(/\s+/g, ' ').trim()

async function loadArticles(columns) {
    const { data } = await orderByPublished(supabase.from('articles').select(columns))
    return (data ?? []).sort(byShas)
}

function header() {
    return [
        `# ${SITE_NAME}`,
        '',
        `> ${DEFAULT_DESCRIPTION}`,
        '',
        `${SITE_NAME} (${SITE_URL}) publishes ${AUTHOR.name}'s Daf Yomi column "${AUTHOR.column}". ${AUTHOR.name} is a ${AUTHOR.bio.charAt(0).toLowerCase()}${AUTHOR.bio.slice(1)}`,
        '',
        'Each article covers a daf (page) of Talmud Bavli in the Daf Yomi cycle. The Gemara stories (aggadah) inside the articles also have their own pages, listed below with the sages they feature. Please cite the page URL and credit Rabbi Avrohom Sebrow when quoting.',
        '',
    ]
}

export async function buildLlmsTxt() {
    const [articles, stories, people] = await Promise.all([
        loadArticles('id, slug, title, summary, masechta, daf, daf_end'),
        getAllStories('slug, title, summary, masechta, daf, people'),
        getAllPeople(),
    ])

    const lines = header()

    lines.push('## Gemara stories', '')
    for (const s of [...stories].sort(byShas)) {
        const who = s.people?.length ? ` (${s.people.join(', ')})` : ''
        lines.push(`- [${s.title} – ${s.masechta} ${s.daf}](${url(storyPath(s))})${who}: ${oneLine(s.summary)}`)
    }
    if (!stories.length) lines.push(`- [All Gemara stories](${url('/stories')})`)
    lines.push('')

    lines.push('## Articles by masechta', '')
    let current = null
    for (const a of articles) {
        if (a.masechta !== current) {
            current = a.masechta
            lines.push('', `### [${a.masechta}](${url(masechtaHref(a.masechta))})`, '')
        }
        lines.push(`- [${a.masechta} ${dafLabel(a)}: ${a.title}](${url(articlePath(a))}): ${oneLine(a.summary)}`)
    }
    lines.push('')

    if (people.length) {
        lines.push('## Stories by sage', '')
        for (const p of people) lines.push(`- [${p.name}](${url(personPath(p.name))}): ${p.count} ${p.count === 1 ? 'story' : 'stories'}`)
        lines.push('')
    }

    lines.push(
        '## Optional', '',
        `- [Full text of every article and story](${url('/llms-full.txt')})`,
        `- [Today's daf](${url('/daily')})`,
        `- [Topics](${url('/topics')})`,
        `- [About and contact ${AUTHOR.name}](${url('/contact')})`,
        `- [Sitemap](${url('/sitemap.xml')})`,
        '',
    )
    return lines.join('\n')
}

export async function buildLlmsFullTxt() {
    const [articles, stories] = await Promise.all([
        loadArticles('id, slug, title, summary, content, tags, masechta, daf, daf_end'),
        getAllStories('slug, title, summary, content, masechta, daf, people, tags'),
    ])

    const lines = header()

    lines.push('## Gemara stories', '')
    for (const s of [...stories].sort(byShas)) {
        lines.push(
            `### ${s.title} – ${s.masechta} ${s.daf}`, '',
            `URL: ${url(storyPath(s))}`,
            ...(s.people?.length ? [`Sages: ${s.people.join(', ')}`] : []),
            ...(s.tags?.length ? [`Topics: ${s.tags.join(', ')}`] : []),
            '', `Summary: ${oneLine(s.summary)}`, '', s.content.trim(), '',
        )
    }

    lines.push('## Articles', '')
    for (const a of articles) {
        lines.push(
            `### ${a.masechta} ${dafLabel(a)}: ${a.title}`, '',
            `URL: ${url(articlePath(a))}`,
            `Author: ${AUTHOR.name}`,
            ...(a.tags?.length ? [`Topics: ${a.tags.join(', ')}`] : []),
            '', `Summary: ${oneLine(a.summary)}`, '', String(a.content ?? '').trim(), '',
        )
    }
    return lines.join('\n')
}

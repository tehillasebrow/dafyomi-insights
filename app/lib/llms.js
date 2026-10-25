// lib/llms.js
// Builds /llms.txt (a Markdown map of the site for AI assistants, per llmstxt.org)
// and /llms-full.txt (the full text of every article and story).
import { supabase } from '@/app/lib/supabase'
import { SITE_URL, SITE_NAME, AUTHOR, DEFAULT_DESCRIPTION } from '@/app/lib/site'
import { MASECHTOS, masechtaHref } from '@/app/lib/shas'
import { articlePath, dafLabel, orderByPublished, BEYOND_THE_DAF, BEYOND_THE_DAF_PATH } from '@/app/lib/articles'
import { getAllStories, storyPath, storyPlace, personPath, getAllPeople } from '@/app/lib/stories'
import { topicsFor } from '@/app/lib/topics'

const url = path => `${SITE_URL}${path}`
const ORDER = new Map(MASECHTOS.map((m, i) => [m.name.toLowerCase(), i]))
// Shas order; anything not on a daf (Beyond the Daf) goes last, keeping its order
const shasRank = x => x.masechta ? ORDER.get(x.masechta.toLowerCase()) ?? 999 : 1000
const byShas = (a, b) =>
    shasRank(a) - shasRank(b)
    || (a.masechta ?? '').localeCompare(b.masechta ?? '')
    || (a.daf ?? 0) - (b.daf ?? 0)
const oneLine = text => String(text ?? '').replace(/\s+/g, ' ').trim()

// Daf articles in Shas order, and the ones that aren't on a daf, newest first
async function loadArticles(columns) {
    const { data } = await orderByPublished(supabase.from('articles').select(columns))
    const all = data ?? []
    return {
        onDaf: all.filter(a => a.masechta).sort(byShas),
        standalone: all.filter(a => !a.masechta),
    }
}

function header() {
    return [
        `# ${SITE_NAME}`,
        '',
        `> ${DEFAULT_DESCRIPTION}`,
        '',
        `${SITE_NAME} (${SITE_URL}) publishes ${AUTHOR.name}'s Daf Yomi column "${AUTHOR.column}". ${AUTHOR.name} is a ${AUTHOR.bio.charAt(0).toLowerCase()}${AUTHOR.bio.slice(1)}`,
        '',
        `Each article covers a daf (page) of Talmud Bavli in the Daf Yomi cycle, except the ones under "${BEYOND_THE_DAF}" (tributes, interviews and other writings). The Gemara stories (aggadah) inside the articles also have their own pages, listed below with the sages they feature. Please cite the page URL and credit Rabbi Avrohom Sebrow when quoting.`,
        '',
    ]
}

export async function buildLlmsTxt() {
    const [{ onDaf: articles, standalone }, stories, people] = await Promise.all([
        loadArticles('id, slug, title, summary, masechta, daf, daf_end'),
        getAllStories('slug, title, summary, masechta, daf, people'),
        getAllPeople(),
    ])

    const lines = header()

    lines.push('## Gemara stories', '')
    for (const s of [...stories].sort(byShas)) {
        const who = s.people?.length ? ` (${s.people.join(', ')})` : ''
        lines.push(`- [${s.title} – ${storyPlace(s)}](${url(storyPath(s))})${who}: ${oneLine(s.summary)}`)
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

    if (standalone.length) {
        lines.push(`## [${BEYOND_THE_DAF}](${url(BEYOND_THE_DAF_PATH)})`, '', 'Tributes, interviews and other writings, not on a particular daf.', '')
        for (const a of standalone) lines.push(`- [${a.title}](${url(articlePath(a))}): ${oneLine(a.summary)}`)
        lines.push('')
    }

    if (people.length) {
        lines.push('## Stories by person', '')
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
    const [{ onDaf: articles, standalone }, stories] = await Promise.all([
        loadArticles('id, slug, title, summary, content, tags, masechta, daf, daf_end'),
        getAllStories('slug, title, summary, content, masechta, daf, people, tags'),
    ])

    const lines = header()

    lines.push('## Gemara stories', '')
    for (const s of [...stories].sort(byShas)) {
        lines.push(
            `### ${s.title} – ${storyPlace(s)}`, '',
            `URL: ${url(storyPath(s))}`,
            ...(s.people?.length ? [`Sages: ${s.people.join(', ')}`] : []),
            ...(topicsFor(s.tags).length ? [`Topics: ${topicsFor(s.tags).map(t => t.name).join(", ")}`] : []),
            '', `Summary: ${oneLine(s.summary)}`, '', s.content.trim(), '',
        )
    }

    lines.push('## Articles', '')
    for (const a of articles) {
        lines.push(
            `### ${a.masechta} ${dafLabel(a)}: ${a.title}`, '',
            `URL: ${url(articlePath(a))}`,
            `Author: ${AUTHOR.name}`,
            ...(topicsFor(a.tags).length ? [`Topics: ${topicsFor(a.tags).map(t => t.name).join(", ")}`] : []),
            '', `Summary: ${oneLine(a.summary)}`, '', String(a.content ?? '').trim(), '',
        )
    }

    if (standalone.length) {
        lines.push(`## ${BEYOND_THE_DAF}`, '')
        for (const a of standalone) {
            lines.push(
                `### ${a.title}`, '',
                `URL: ${url(articlePath(a))}`,
                `Author: ${AUTHOR.name}`,
                ...(topicsFor(a.tags).length ? [`Topics: ${topicsFor(a.tags).map(t => t.name).join(", ")}`] : []),
                '', `Summary: ${oneLine(a.summary)}`, '', String(a.content ?? '').trim(), '',
            )
        }
    }
    return lines.join('\n')
}

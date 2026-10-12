// scripts/import/lib/daf.mjs
// Works out which masechta and daf a column is about. The column follows the Daf
// Yomi, so the daf is the one it cites that falls near the Daf Yomi of the issue
// date (the column is written a few days ahead or behind). If nothing it cites is
// near, the Daf Yomi of the issue date is used and the article is flagged.
import { MASECHTOS, CYCLE_LENGTH, findMasechta, dafYomiFor } from '../../../app/lib/shas.js'

// Daf Yomi position of every masechta's first daf
const OFFSETS = new Map()
{
    let before = 0
    for (const m of MASECHTOS) {
        OFFSETS.set(m.name, before)
        before += m.dafim
    }
}

function position(masechta, daf) {
    return OFFSETS.get(masechta.name) + daf - masechta.first
}

// "Kesubos 37b", "Rosh Hashana (30a)", "Bava Metzia 23", "Sukkah (41)"
const CITATION = /\b([A-Z][a-z’']+(?:\s+[A-Z][a-z’']+)?)\s*\(?\s*(\d{1,3})\s*([ab])?\b/g

export function findCitations(text) {
    const found = []
    for (const match of text.matchAll(CITATION)) {
        const [, name, num, amud] = match
        const daf = Number(num)
        // Try the two-word name, then just the last word ("Talmud Kesubos" -> "Kesubos")
        const words = name.split(/\s+/)
        const masechta = findMasechta(name) ?? (words.length > 1 ? findMasechta(words.at(-1)) : null)
        if (!masechta || daf < masechta.first || daf > masechta.last) continue
        found.push({ masechta: masechta.name, daf, amud: amud || null, index: match.index })
    }
    return found
}

// date: the issue's cover date (Date at UTC midnight)
export function chooseDaf(text, date) {
    const warnings = []
    const today = dafYomiFor(date)
    const citations = findCitations(text)

    // Within 10 dafim before and 21 after the issue date's daf, across the cycle boundary
    const center = today.position - 1
    const near = citations.filter(c => {
        const p = position(findMasechta(c.masechta), c.daf)
        const diff = (p - center + CYCLE_LENGTH + CYCLE_LENGTH / 2) % CYCLE_LENGTH - CYCLE_LENGTH / 2
        return diff >= -10 && diff <= 21
    })

    if (near.length) {
        // The most-cited daf near the schedule; ties go to the first one mentioned
        const counts = new Map()
        for (const c of near) {
            const key = `${c.masechta}|${c.daf}`
            counts.set(key, (counts.get(key) || 0) + 1)
        }
        const best = near.slice().sort((a, b) => counts.get(`${b.masechta}|${b.daf}`) - counts.get(`${a.masechta}|${a.daf}`) || a.index - b.index)[0]
        const others = [...new Set(near.map(c => `${c.masechta} ${c.daf}`))].filter(s => s !== `${best.masechta} ${best.daf}`)
        if (others.length) warnings.push(`Also cites ${others.join(', ')} near this week's daf`)
        return { masechta: best.masechta, daf: best.daf, how: 'cited', citations, warnings }
    }

    const sameMasechta = citations.filter(c => c.masechta === today.masechta.name)
    if (sameMasechta.length) {
        warnings.push(`Cited daf ${sameMasechta[0].daf} is far from this week's Daf Yomi (${today.masechta.name} ${today.daf}): check the daf`)
        return { masechta: sameMasechta[0].masechta, daf: sameMasechta[0].daf, how: 'cited-far', citations, warnings }
    }

    warnings.push(`No daf cited near this week's: used the Daf Yomi of the issue date (${today.masechta.name} ${today.daf}). Check it`)
    return { masechta: today.masechta.name, daf: today.daf, how: 'date', citations, warnings }
}

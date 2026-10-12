// Masechtos of Talmud Bavli in Daf Yomi order, with their Daf Yomi page ranges.
// Kinnim, Tamid and Middos continue Meilah's pagination in the Daf Yomi schedule.
export const SEDARIM = [
    { name: 'Zeraim', hebrew: 'זרעים' },
    { name: 'Moed', hebrew: 'מועד' },
    { name: 'Nashim', hebrew: 'נשים' },
    { name: 'Nezikin', hebrew: 'נזיקין' },
    { name: 'Kodashim', hebrew: 'קדשים' },
    { name: 'Taharos', hebrew: 'טהרות' },
]

export const MASECHTOS = [
    ['Berachos', 'ברכות', 'Zeraim', 2, 64],
    ['Shabbos', 'שבת', 'Moed', 2, 157],
    ['Eruvin', 'עירובין', 'Moed', 2, 105],
    ['Pesachim', 'פסחים', 'Moed', 2, 121],
    ['Shekalim', 'שקלים', 'Moed', 2, 22],
    ['Yoma', 'יומא', 'Moed', 2, 88],
    ['Sukkah', 'סוכה', 'Moed', 2, 56],
    ['Beitzah', 'ביצה', 'Moed', 2, 40],
    ['Rosh Hashanah', 'ראש השנה', 'Moed', 2, 35],
    ['Taanis', 'תענית', 'Moed', 2, 31],
    ['Megillah', 'מגילה', 'Moed', 2, 32],
    ['Moed Katan', 'מועד קטן', 'Moed', 2, 29],
    ['Chagigah', 'חגיגה', 'Moed', 2, 27],
    ['Yevamos', 'יבמות', 'Nashim', 2, 122],
    ['Kesubos', 'כתובות', 'Nashim', 2, 112],
    ['Nedarim', 'נדרים', 'Nashim', 2, 91],
    ['Nazir', 'נזיר', 'Nashim', 2, 66],
    ['Sotah', 'סוטה', 'Nashim', 2, 49],
    ['Gittin', 'גיטין', 'Nashim', 2, 90],
    ['Kiddushin', 'קידושין', 'Nashim', 2, 82],
    ['Bava Kamma', 'בבא קמא', 'Nezikin', 2, 119],
    ['Bava Metzia', 'בבא מציעא', 'Nezikin', 2, 119],
    ['Bava Basra', 'בבא בתרא', 'Nezikin', 2, 176],
    ['Sanhedrin', 'סנהדרין', 'Nezikin', 2, 113],
    ['Makkos', 'מכות', 'Nezikin', 2, 24],
    ['Shevuos', 'שבועות', 'Nezikin', 2, 49],
    ['Avodah Zarah', 'עבודה זרה', 'Nezikin', 2, 76],
    ['Horayos', 'הוריות', 'Nezikin', 2, 14],
    ['Zevachim', 'זבחים', 'Kodashim', 2, 120],
    ['Menachos', 'מנחות', 'Kodashim', 2, 110],
    ['Chullin', 'חולין', 'Kodashim', 2, 142],
    ['Bechoros', 'בכורות', 'Kodashim', 2, 61],
    ['Arachin', 'ערכין', 'Kodashim', 2, 34],
    ['Temurah', 'תמורה', 'Kodashim', 2, 34],
    ['Kerisus', 'כריתות', 'Kodashim', 2, 28],
    ['Meilah', 'מעילה', 'Kodashim', 2, 22],
    ['Kinnim', 'קינים', 'Kodashim', 23, 25],
    ['Tamid', 'תמיד', 'Kodashim', 26, 33],
    ['Middos', 'מדות', 'Kodashim', 34, 37],
    ['Niddah', 'נדה', 'Taharos', 2, 73],
].map(([name, hebrew, seder, first, last]) => ({ name, hebrew, seder, first, last, dafim: last - first + 1 }))

export const CYCLE_LENGTH = MASECHTOS.reduce((sum, m) => sum + m.dafim, 0) // 2711
const CYCLE_14_START = Date.UTC(2020, 0, 5) // Berachos 2

// Loose key so "Bava Batra", "Bava Basra" and "bava-basra" all match.
function skeleton(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/kh/g, 'ch')
        .replace(/th/g, 's')
        .replace(/c(?!h)/g, 'k')
        .replace(/([^cs])h/g, '$1')
        .replace(/t/g, 's')
        .replace(/(?!^)[aeiou]/g, '')
        .replace(/(.)\1+/g, '$1')
}
const ALIASES = { ksvs: 'Kesubos', krss: 'Kerisus' }
const BY_KEY = new Map(MASECHTOS.map(m => [skeleton(m.name), m]))

export function findMasechta(name) {
    if (!name) return null
    const key = skeleton(name)
    return BY_KEY.get(key) ?? MASECHTOS.find(m => m.name === ALIASES[key]) ?? null
}

export function masechtaHref(name) {
    return `/daf/${encodeURIComponent(name.toLowerCase())}`
}



export function titleCase(slug) {
    return slug.replace(/\b\w/g, c => c.toUpperCase())
}

// --- Hebrew numerals -------------------------------------------------------

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת']

export function hebrewNumeral(n, { punctuate = true } = {}) {
    n = Math.floor(Number(n))
    if (!n || n < 1) return ''
    let letters = ''
    while (n >= 400) { letters += 'ת'; n -= 400 }
    letters += HUNDREDS[Math.floor(n / 100)]
    n %= 100
    if (n === 15) letters += 'טו'
    else if (n === 16) letters += 'טז'
    else letters += TENS[Math.floor(n / 10)] + ONES[n % 10]
    if (!punctuate) return letters
    return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`
}

// --- Calendar ----------------------------------------------------------------

const TZ = 'America/New_York'

// Midnight UTC of the current calendar day in New York.
export function todayInNewYork(now = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
            .formatToParts(now)
            .map(p => [p.type, p.value])
    )
    return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day))
}

export function dafYomiFor(date) {
    const days = Math.round((date.getTime() - CYCLE_14_START) / 86400000)
    const position = ((days % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH
    let remaining = position
    for (const m of MASECHTOS) {
        if (remaining < m.dafim) {
            return { masechta: m, daf: m.first + remaining, position: position + 1 }
        }
        remaining -= m.dafim
    }
}

const DAY = 86400000

// Hebrew month names as printed in a luach, keyed by ICU's English names.
const MONTHS = {
    Tishri: ['Tishrei', 'תשרי'], Heshvan: ['Cheshvan', 'חשון'], Kislev: ['Kislev', 'כסלו'],
    Tevet: ['Teves', 'טבת'], Shevat: ['Shevat', 'שבט'], Adar: ['Adar', 'אדר'],
    'Adar I': ['Adar I', 'אדר א׳'], 'Adar II': ['Adar II', 'אדר ב׳'], Nisan: ['Nissan', 'ניסן'],
    Iyar: ['Iyar', 'אייר'], Sivan: ['Sivan', 'סיון'], Tamuz: ['Tammuz', 'תמוז'], Av: ['Av', 'אב'], Elul: ['Elul', 'אלול'],
}

// The Hebrew date of a civil day (UTC midnight). It does not roll over at sunset.
export function hebrewDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {
        timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
    }).formatToParts(date)
    const get = type => parts.find(p => p.type === type)?.value
    const icuMonth = get('month')
    const [month, monthHe] = MONTHS[icuMonth] ?? [icuMonth, icuMonth]
    return { day: Number(get('day')), month, monthHe, icuMonth, year: Number(get('year')) }
}

export function hebrewDate(date, { year = true } = {}) {
    const { day, monthHe, year: y } = hebrewDateParts(date)
    return `${hebrewNumeral(day)} ${monthHe}${year ? ` ${hebrewNumeral(y % 1000)}` : ''}`
}

// Diaspora Yamim Tovim (no melachah, so the discussion is closed).
const YOM_TOV = {
    Tishri: { 1: 'Rosh Hashanah', 2: 'Rosh Hashanah', 10: 'Yom Kippur', 15: 'Sukkos', 16: 'Sukkos', 22: 'Shemini Atzeres', 23: 'Simchas Torah' },
    Nisan: { 15: 'Pesach', 16: 'Pesach', 21: 'Pesach', 22: 'Pesach' },
    Sivan: { 6: 'Shavuos', 7: 'Shavuos' },
}

export function yomTovName(date) {
    const { day, icuMonth } = hebrewDateParts(date)
    return YOM_TOV[icuMonth]?.[day] ?? null
}

// What a luach prints under the date: Yom Tov, Chol Hamoed, Rosh Chodesh, Chanukah, Purim, Tisha B'Av.
export function dayLabel(date) {
    const yt = yomTovName(date)
    if (yt) return { name: yt, short: yt, closed: true }
    const { day, icuMonth } = hebrewDateParts(date)
    if (icuMonth === 'Tishri' && day === 21) return { name: 'Hoshana Rabbah', short: 'Hoshana Rabbah' }
    if ((icuMonth === 'Tishri' && day >= 17 && day <= 20) || (icuMonth === 'Nisan' && day >= 17 && day <= 20)) {
        return { name: 'Chol Hamoed', short: 'חוה״מ' }
    }
    if (day === 30 || (day === 1 && icuMonth !== 'Tishri')) {
        const next = hebrewDateParts(new Date(date.getTime() + (day === 30 ? DAY : 0)))
        return { name: `Rosh Chodesh ${next.month}`, short: 'ר״ח' }
    }
    if (icuMonth === 'Kislev' && day >= 25) return { name: 'Chanukah', short: 'חנוכה' }
    if (icuMonth === 'Tevet') {
        const kislevLength = hebrewDateParts(new Date(date.getTime() - day * DAY)).day // last day of Kislev
        if (day + kislevLength - 25 <= 7) return { name: 'Chanukah', short: 'חנוכה' }
    }
    if (day === 14 && (icuMonth === 'Adar' || icuMonth === 'Adar II')) return { name: 'Purim', short: 'פורים' }
    if (day === 9 && icuMonth === 'Av' && date.getUTCDay() !== 6) return { name: "Tisha B'Av", short: 'ט׳ באב' }
    if (day === 10 && icuMonth === 'Av' && new Date(date.getTime() - DAY).getUTCDay() === 6) return { name: "Tisha B'Av (nidcheh)", short: 'ט׳ באב' }
    return null
}

// The Sunday–Shabbos week containing `date`, with each day's daf.
export function weekOfDafim(date) {
    const sunday = new Date(date.getTime() - date.getUTCDay() * DAY)
    return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(sunday.getTime() + i * DAY)
        return { date: day, isToday: day.getTime() === date.getTime(), label: dayLabel(day), ...dafYomiFor(day) }
    })
}

// The civil date on which a daf is learned in the current cycle (or the next one,
// for a masechta already finished when `after` is given and the date is past).
export function dateOfDaf(masechtaName, daf, today = todayInNewYork()) {
    let before = 0
    for (const m of MASECHTOS) {
        if (m.name === masechtaName) {
            const offset = before + Math.min(Math.max(daf, m.first), m.last) - m.first
            const cycles = Math.floor((today.getTime() - CYCLE_14_START) / DAY / CYCLE_LENGTH)
            return new Date(CYCLE_14_START + (cycles * CYCLE_LENGTH + offset) * DAY)
        }
        before += m.dafim
    }
    return null
}

// Date of the masechta's last daf in the current cycle.
export function siyumDate(masechta, today = todayInNewYork()) {
    return dateOfDaf(masechta.name, masechta.last, today)
}

export function siyumHaShasDate(today = todayInNewYork()) {
    return siyumDate(MASECHTOS[MASECHTOS.length - 1], today)
}

// --- Zmanim (West Hempstead, NY) ----------------------------------------------

const LAT = 40.7048
const LNG = -73.6501
const rad = d => (d * Math.PI) / 180
const deg = r => (r * 180) / Math.PI

// Sunset (NOAA approximation) for a civil day given as UTC midnight.
export function sunset(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0)
    const n = Math.floor((date.getTime() - start) / DAY)
    const lngHour = LNG / 15
    const t = n + (18 - lngHour) / 24
    const M = 0.9856 * t - 3.289
    let L = (M + 1.916 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 282.634) % 360
    if (L < 0) L += 360
    let RA = deg(Math.atan(0.91764 * Math.tan(rad(L)))) % 360
    if (RA < 0) RA += 360
    RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15
    const sinDec = 0.39782 * Math.sin(rad(L))
    const cosDec = Math.cos(Math.asin(sinDec))
    const cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(LAT))) / (cosDec * Math.cos(rad(LAT)))
    const H = deg(Math.acos(cosH)) / 15
    let UT = (H + RA - 0.06571 * t - 6.622 - lngHour) % 24
    if (UT < 12) UT += 24 // New York sunset is always in the UTC evening or just after midnight
    return new Date(date.getTime() + UT * 3600000)
}

const isHoly = date => date.getUTCDay() === 6 || Boolean(yomTovName(date))
const holyName = date => yomTovName(date) ?? 'Shabbos Kodesh'

// Comments close from candle-lighting (18 min before sunset) to nightfall (50 min after).
export function postingStatus(now = new Date()) {
    const today = todayInNewYork(now)
    const tomorrow = new Date(today.getTime() + DAY)
    const candles = sunset(today).getTime() - 18 * 60000
    const nightfall = sunset(today).getTime() + 50 * 60000

    let holyDay = null
    if (isHoly(today) && (now.getTime() < nightfall || isHoly(tomorrow))) holyDay = now.getTime() < nightfall ? today : tomorrow
    else if (isHoly(tomorrow) && now.getTime() >= candles) holyDay = tomorrow
    if (!holyDay) return { closed: false }

    let last = holyDay
    while (isHoly(new Date(last.getTime() + DAY))) last = new Date(last.getTime() + DAY)
    return { closed: true, name: holyName(holyDay), reopens: new Date(sunset(last).getTime() + 50 * 60000) }
}

// --- Daf lookup ("Bechoros 23", "בכורות כג", "bechoros 23b") --------------------

const LETTER_VALUES = Object.fromEntries([
    ...ONES.slice(1).map((l, i) => [l, i + 1]),
    ...TENS.slice(1).map((l, i) => [l, (i + 1) * 10]),
    ...HUNDREDS.slice(1).map((l, i) => [l, (i + 1) * 100]),
])

export function parseHebrewNumeral(text) {
    let total = 0
    for (const ch of String(text).replace(/[״׳"'.:]/g, '')) {
        if (!LETTER_VALUES[ch]) return null
        total += LETTER_VALUES[ch]
    }
    return total || null
}

export function parseDafQuery(query) {
    const match = String(query).trim().match(/^(.+?)\s+(\d{1,3}|[א-ת]{1,4}[״׳"']?[א-ת]?)\s*([ab]|[.:]|ע״?[אב])?$/i)
    if (!match) return null
    const [, name, num] = match
    const masechta = /[א-ת]/.test(name)
        ? MASECHTOS.find(m => m.hebrew === name.replace(/\s+/g, ' ').trim())
        : findMasechta(name)
    if (!masechta) return null
    const daf = /^\d+$/.test(num) ? Number(num) : parseHebrewNumeral(num)
    if (!daf || daf < masechta.first || daf > masechta.last) return null
    return { masechta, daf }
}

// --- Articles ----------------------------------------------------------------

export function formatDate(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
    return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC', ...options })
}

const HEBREW_CHAR = /[֐-׿]/g
export function isMostlyHebrew(text) {
    const letters = text.replace(/[^\p{L}]/gu, '').length
    return letters > 0 && (text.match(HEBREW_CHAR)?.length ?? 0) / letters > 0.5
}

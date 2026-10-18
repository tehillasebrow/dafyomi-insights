'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dafYomiFor, todayInNewYork, hebrewDate, hebrewNumeral } from '@/app/lib/shas'

const noSubscription = () => () => {}

// The yellow strip under the masthead: today's daf and the Hebrew date.
// Worked out in the browser, so a cached page never shows yesterday's daf.
// On a wide home page the today panel already says this, so the strip steps aside.
export default function TodayStrip() {
    const key = useSyncExternalStore(noSubscription, () => todayInNewYork().toISOString().slice(0, 10), () => todayInNewYork().toISOString().slice(0, 10))
    const home = usePathname() === '/'
    const today = key ? new Date(`${key}T00:00:00Z`) : null
    const daf = today ? dafYomiFor(today) : null

    return (
        <div className={`bg-foil text-[#17181c] ${home ? 'lg:hidden' : ''}`}>
            <div className="folio flex items-center justify-between gap-4 min-h-11 text-small">
                {daf ? (
                    <Link href="/daily" className="plain inline-flex items-center gap-[0.6ch] min-h-11 hover:underline">
                        <span lang="he" aria-hidden="true" className="numeral text-[1.2rem]">{hebrewNumeral(daf.daf)}</span>
                        Today’s daf: <b className="font-bold">{daf.masechta.name} {daf.daf}</b>
                    </Link>
                ) : <span />}
                <span lang="he" dir="rtl" className="font-hebrew text-[1rem] max-sm:hidden">{today ? hebrewDate(today) : ''}</span>
            </div>
        </div>
    )
}

'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dafYomiFor, todayInNewYork, hebrewDate } from '@/app/lib/shas'

const noSubscription = () => () => {}

// The binding strip above the masthead: the Hebrew date and today's daf in gold.
// Worked out in the browser, so a cached page never shows yesterday's daf.
export default function TodayStrip() {
    const key = useSyncExternalStore(noSubscription, () => todayInNewYork().toISOString().slice(0, 10), () => todayInNewYork().toISOString().slice(0, 10))
    const home = usePathname() === '/'
    const today = key ? new Date(`${key}T00:00:00Z`) : null
    const daf = today ? dafYomiFor(today) : null

    return (
        <div className="border-b border-binding-line">
            <div className="folio flex items-center justify-between gap-4 min-h-11 font-mono text-small">
                <span lang="he" dir="rtl" className="font-hebrew text-[1rem] text-binding-ink">{today ? hebrewDate(today) : ''}</span>
                {daf && !home && (
                    <Link href="/daily" className="plain hover:underline text-binding-soft inline-flex items-center gap-[0.6ch] min-h-11">
                        Today <b className="font-medium text-foil">{daf.masechta.name} {daf.daf}</b>
                    </Link>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MASECHTOS, dafYomiFor, todayInNewYork } from '@/app/lib/shas'
import { dafPath } from '@/app/lib/articles'

// "Go to a daf": two selects that open the article on that daf (or say there isn't one yet).
// Defaults to today's daf; the server passes it in so the first render matches.
export default function DafPicker({ initialMasechta, initialDaf, id = 'daf-picker', onGo }) {
    const router = useRouter()
    const fallback = dafYomiFor(todayInNewYork())
    const [name, setName] = useState(initialMasechta ?? fallback.masechta.name)
    const masechta = MASECHTOS.find(m => m.name === name) ?? MASECHTOS[0]
    const [daf, setDaf] = useState(initialDaf ?? fallback.daf)
    const safeDaf = Math.min(Math.max(daf, masechta.first), masechta.last)

    function submit(e) {
        e.preventDefault()
        onGo?.()
        router.push(dafPath(masechta.name, safeDaf))
    }

    return (
        <form onSubmit={submit} className="grid gap-2" aria-labelledby={`${id}-h`}>
            <span id={`${id}-h`} className="sc">Go to a daf</span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
                <label className="sr-only" htmlFor={`${id}-m`}>Masechta</label>
                <select id={`${id}-m`} className="field col-span-2" value={name} onChange={e => setName(e.target.value)}>
                    {MASECHTOS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
                <label className="sr-only" htmlFor={`${id}-d`}>Daf</label>
                <select id={`${id}-d`} className="field" value={safeDaf} onChange={e => setDaf(Number(e.target.value))}>
                    {Array.from({ length: masechta.dafim }, (_, i) => masechta.first + i).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button type="submit" className="btn !min-h-12 !px-4">Go</button>
            </div>
        </form>
    )
}

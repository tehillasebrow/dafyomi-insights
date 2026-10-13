'use client'

import { useActionState, useEffect, useId } from 'react'
import { subscribe } from '@/app/lib/newsletterActions'

export const SUBSCRIBED_KEY = 'newsletter-subscribed'

export function rememberSubscribed() {
    try { localStorage.setItem(SUBSCRIBED_KEY, '1') } catch {}
}

// Email box + button. `onBinding` styles it for the dark footer.
export default function SubscribeForm({ source, onBinding = false, onSubscribed, defaultEmail = '' }) {
    const [state, formAction, pending] = useActionState(subscribe, {})
    const id = useId()

    useEffect(() => {
        if (!state?.ok) return
        rememberSubscribed()
        onSubscribed?.()
    }, [state, onSubscribed])

    if (state?.ok) {
        return <p className="note" role="status">✓ You’re subscribed. New articles will come to your inbox.</p>
    }

    return (
        <form action={formAction} className="grid gap-2" noValidate>
            <input type="hidden" name="source" value={source} />
            {/* Honeypot: hidden from people, filled in by bots */}
            <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
            <div className="flex flex-wrap gap-2">
                <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    defaultValue={defaultEmail}
                    placeholder="Your email address"
                    className="field flex-1 min-w-[12rem]"
                    aria-invalid={state?.error ? true : undefined}
                    aria-describedby={state?.error ? `${id}-err` : undefined}
                />
                <button type="submit" className={onBinding ? 'btn bg-foil text-binding hover:bg-binding-ink' : 'btn'} disabled={pending}>
                    {pending ? 'Signing up…' : 'Sign up'}
                </button>
            </div>
            {state?.error && <p id={`${id}-err`} className="note" role="alert">{state.error}</p>}
        </form>
    )
}

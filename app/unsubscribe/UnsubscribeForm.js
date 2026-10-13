'use client'

import { useActionState } from 'react'
import { unsubscribe } from '@/app/lib/newsletterActions'
import SubscribeForm from '@/app/components/SubscribeForm'

// A button rather than unsubscribing on page load: email security scanners open
// links before people do, and would otherwise unsubscribe them.
export default function UnsubscribeForm({ token }) {
    const [state, formAction, pending] = useActionState(unsubscribe, {})

    if (state?.ok) {
        return (
            <div className="grid gap-6">
                <p role="status">You’ve been unsubscribed and won’t get any more emails from us.</p>
                <div className="grid gap-2">
                    <p className="note">Changed your mind?</p>
                    <SubscribeForm source="unsubscribe_page" defaultEmail={state.email} />
                </div>
            </div>
        )
    }

    return (
        <form action={formAction} className="grid gap-4 justify-items-start">
            <input type="hidden" name="token" value={token} />
            <p>Stop getting new Daf Yomi Insights articles by email?</p>
            <button type="submit" className="btn" disabled={pending}>{pending ? 'Unsubscribing…' : 'Unsubscribe'}</button>
            {state?.error && <p className="note" role="alert">{state.error}</p>}
        </form>
    )
}

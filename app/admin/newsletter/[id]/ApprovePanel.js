'use client'

import { useActionState } from 'react'
import { approveSend, skipSend } from '@/app/lib/newsletterActions'

export default function ApprovePanel({ id, subscribers }) {
    const [approveState, approveAction, approving] = useActionState(approveSend, {})
    const [skipState, skipAction, skipping] = useActionState(skipSend, {})
    const state = approveState?.error || approveState?.success ? approveState : skipState
    const done = Boolean(approveState?.success || skipState?.success)
    const busy = approving || skipping

    return (
        <div className="grid gap-3 mt-2">
            {(state?.error || state?.success) && (
                <div className={`p-4 rounded-lg text-center font-bold ${state.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {state.error || state.success}
                </div>
            )}
            {!done && (
                <div className="flex flex-wrap gap-3">
                    <form action={approveAction}>
                        <input type="hidden" name="id" value={id} />
                        <button type="submit" disabled={busy} className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-60">
                            {approving ? 'Sending…' : `Approve & send to ${subscribers} subscriber${subscribers === 1 ? '' : 's'}`}
                        </button>
                    </form>
                    <form action={skipAction}>
                        <input type="hidden" name="id" value={id} />
                        <button type="submit" disabled={busy} className="px-5 py-3 rounded-lg font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 transition disabled:opacity-60">
                            {skipping ? 'Skipping…' : "Don't email this one"}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}

'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginForm() {
    const [state, formAction, pending] = useActionState(login, { error: null })

    return (
        <form action={formAction} className="space-y-4 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            {state?.error && (
                <div className="p-4 rounded-lg text-center font-bold bg-red-50 text-red-600">{state.error}</div>
            )}
            <div>
                <label className="block text-sm font-bold mb-2">Access Code</label>
                <input type="password" name="password" autoComplete="current-password" className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Enter secret code" required />
            </div>
            <button type="submit" disabled={pending} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                {pending ? 'Checking...' : 'Log In'}
            </button>
        </form>
    )
}

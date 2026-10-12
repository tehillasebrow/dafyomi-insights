'use client'

import { useState } from 'react'

export default function CopyText({ text, label = 'Copy' }) {
    const [status, setStatus] = useState('')
    async function copy() {
        try {
            await navigator.clipboard.writeText(text)
            setStatus('Copied')
        } catch {
            setStatus('Couldn’t copy. Press and hold the address to copy it.')
        }
        setTimeout(() => setStatus(''), 4000)
    }
    return (
        <>
            <button type="button" className="btn-quiet" onClick={copy}>{label}</button>
            <span role="status" className="meta">{status}</span>
        </>
    )
}

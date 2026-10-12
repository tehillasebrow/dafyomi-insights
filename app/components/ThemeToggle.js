'use client'

import { useEffect } from 'react'

// Two-state override of the system colour scheme: the visible label always offers the
// opposite of what is on screen. Choosing the system's own scheme clears the override.
export default function ThemeToggle({ className = 'btn-quiet' }) {
    useEffect(() => {
        const sync = e => {
            if (e.key !== 'color-scheme') return
            const meta = document.querySelector('meta[name="color-scheme"]')
            if (meta) meta.content = e.newValue ?? 'light dark'
        }
        window.addEventListener('storage', sync)
        return () => window.removeEventListener('storage', sync)
    }, [])

    function toggle() {
        const meta = document.querySelector('meta[name="color-scheme"]')
        if (!meta) return
        const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        const shown = meta.content === 'light dark' ? system : meta.content
        const target = shown === 'dark' ? 'light' : 'dark'
        try {
            if (target === system) localStorage.removeItem('color-scheme')
            else localStorage.setItem('color-scheme', target)
        } catch {}
        meta.content = target === system ? 'light dark' : target
    }

    return (
        <button type="button" onClick={toggle} className={className}>
            <span className="scheme-light-only">Switch to night reading</span>
            <span className="scheme-dark-only">Switch to day reading</span>
        </button>
    )
}

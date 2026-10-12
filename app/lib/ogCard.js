// lib/ogCard.js
// The 1200×630 social preview card (WhatsApp, Facebook, X, iMessage), rendered
// with next/og. Colors match the site icon.
import { ImageResponse } from 'next/og'
import { SITE_NAME, AUTHOR } from '@/app/lib/site'

export const OG_SIZE = { width: 1200, height: 630 }

const INK = '#1c1e23'
const GOLD = '#c8a24a'
const PAPER = '#f5f5f2'

function Mark() {
    return (
        <svg viewBox="0 0 32 32" width="72" height="72">
            <rect width="32" height="32" fill={INK} />
            <path d="M5 5h9v3H8v19H5z" fill={GOLD} />
            <path d="M27 5h-9v3h6v19h3z" fill={GOLD} />
            <rect x="10" y="10" width="12" height="12" fill={GOLD} />
            <rect x="10" y="24" width="12" height="3" fill={GOLD} />
        </svg>
    )
}

// eyebrow: small line above the title (e.g. "Bava Metzia 59 · Gemara Story")
export function ogCard({ eyebrow, title, subtitle }) {
    const titleSize = title.length > 70 ? 56 : title.length > 40 ? 68 : 80

    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: INK, color: PAPER, padding: '64px 72px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <Mark />
                    <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>{SITE_NAME}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
                    {eyebrow && (
                        <div style={{ fontSize: 30, color: GOLD, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 20 }}>{eyebrow}</div>
                    )}
                    <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
                    {subtitle && (
                        <div style={{ fontSize: 30, color: '#b9bcc4', marginTop: 24, lineHeight: 1.35 }}>{subtitle}</div>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#b9bcc4', borderTop: `2px solid ${GOLD}`, paddingTop: 24 }}>
                    <div>{AUTHOR.name}</div>
                    <div>dafyomiinsights.com</div>
                </div>
            </div>
        ),
        OG_SIZE
    )
}

import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
    return new ImageResponse(
        (
            <svg viewBox="0 0 32 32" width="180" height="180">
                <rect width="32" height="32" fill="#1c1e23" />
                <path d="M5 5h9v3H8v19H5z" fill="#c8a24a" />
                <path d="M27 5h-9v3h6v19h3z" fill="#c8a24a" />
                <rect x="10" y="10" width="12" height="12" fill="#c8a24a" />
                <rect x="10" y="24" width="12" height="3" fill="#c8a24a" />
            </svg>
        ),
        size
    )
}

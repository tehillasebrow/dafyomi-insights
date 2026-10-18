import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
    return new ImageResponse(
        (
            <svg viewBox="0 0 32 32" width="180" height="180">
                <rect width="32" height="32" fill="#17181c" />
                <path d="M5 5h9v3H8v19H5z" fill="#ffe53b" />
                <path d="M27 5h-9v3h6v19h3z" fill="#ffe53b" />
                <rect x="10" y="10" width="12" height="12" fill="#ffe53b" />
                <rect x="10" y="24" width="12" height="3" fill="#ffe53b" />
            </svg>
        ),
        size
    )
}

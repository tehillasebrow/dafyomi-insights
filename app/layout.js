import './globals.css'
import { Suez_One, Literata, Frank_Ruhl_Libre, Noto_Rashi_Hebrew } from 'next/font/google'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import SubscribePopup from './components/SubscribePopup'
import Analytics from './components/Analytics'
import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import JsonLd from './components/JsonLd'
import { SITE_URL, SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION, KEYWORDS, AUTHOR } from './lib/site'
import { websiteJsonLd } from './lib/seo'

export const metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: DEFAULT_TITLE,
        template: `%s | ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: KEYWORDS,
    applicationName: SITE_NAME,
    authors: [{ name: AUTHOR.name, url: '/contact' }],
    creator: AUTHOR.name,
    publisher: AUTHOR.name,
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
    openGraph: {
        type: 'website',
        siteName: SITE_NAME,
        locale: 'en_US',
        url: '/',
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
    },
    twitter: {
        card: 'summary_large_image',
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
    },
    verification: {
        google: 'TGCY40qeKGYZRzWKmdNNppBGhRa8qHlCIGzmzMMFvbY',
    },
}

// Suez One sets titles and Hebrew daf numerals; Literata carries the reading. Literata has no
// Hebrew and no metric fallback, so Hebrew text falls through to Frank Ruhl, not Times.
const frankRuhl = Frank_Ruhl_Libre({ subsets: ['hebrew'], weight: ['400', '500', '700'], variable: '--font-frank-ruhl', adjustFontFallback: false, display: 'swap' })
const rashi = Noto_Rashi_Hebrew({ subsets: ['hebrew'], weight: ['400', '500'], variable: '--font-rashi', adjustFontFallback: false, display: 'swap' })
const suez = Suez_One({ subsets: ['latin', 'hebrew'], weight: '400', variable: '--font-suez', adjustFontFallback: false, display: 'swap' })
const literata = Literata({ subsets: ['latin'], axes: ['opsz'], style: ['normal', 'italic'], variable: '--font-literata', adjustFontFallback: false, display: 'swap' })

export const viewport = {
    themeColor: '#ffe53b',
}

// Applies a saved night/day choice before the first paint. It only updates the meta tag;
// the CSS keys off that tag, so the site still follows the system setting without JS.
const THEME_SCRIPT = `try{var s=localStorage.getItem("color-scheme");if(s)document.querySelector('meta[name="color-scheme"]').content=s}catch(e){}`

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={`${suez.variable} ${literata.variable} ${frankRuhl.variable} ${rashi.variable}`} suppressHydrationWarning>
        <head>
            <meta name="color-scheme" content="light dark" suppressHydrationWarning />
            <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </head>
        <body>
        <Analytics />
        <JsonLd data={websiteJsonLd()} />
        <SiteHeader />
        <main id="main" className="min-h-[60vh]">
            {children}
        </main>
        <SiteFooter />
        <SubscribePopup />
        <VercelAnalytics />
        <SpeedInsights />
        </body>
        </html>
    )
}

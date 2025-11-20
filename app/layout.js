import './globals.css'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import Search from './components/Search'

export const metadata = {
    title: 'Daf Yomi Insights | Daily Gemara Articles by Rabbi Avrohom Sebrow',
    description: 'A searchable archive of interesting Daf Yomi articles, daily summaries, and deep Halachic insights. Explore the Daily Daf with clear explanations.',
    keywords: ['Daf Yomi', 'Daily Daf', 'Gemara', 'Talmud', 'Rabbi Avrohom Sebrow', 'Halacha', 'Jewish Learning'], // Add this line!
    verification: {
        google: 'TGCY40qeKGYZRzWKmdNNppBGhRa8qHlCIGzmzMMFvbY',
    },
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <body className="bg-slate-50 text-slate-900 font-serif antialiased">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold text-slate-900 tracking-tight hover:text-blue-700 transition">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                    <span className="hidden md:inline">DafYomi<span className="text-blue-600">Insights</span></span>
                    <span className="md:hidden">DY<span className="text-blue-600">Insights</span></span>
                </Link>

                {/* Nav Links */}
                <div className="flex items-center gap-4 md:gap-8 text-sm font-sans font-medium">
                    {/* NEW LINK: DAILY DAF */}
                    <Link href="/daily" className="text-blue-600 font-bold hover:text-blue-800 transition">
                        Daily Daf
                    </Link>

                    <Link href="/masechtos" className="text-slate-600 hover:text-blue-600 transition">
                        Masechtos
                    </Link>

                    <Link href="/topics" className="text-slate-600 hover:text-blue-600 transition">
                        Topics
                    </Link>

                    <Link href="/contact" className="text-slate-600 hover:text-blue-600 transition">
                        Contact
                    </Link>

                    {/* Search Bar */}
                    <Search />
                </div>
            </div>
        </nav>

        <main className="min-h-screen">
            {children}
        </main>

        <footer className="bg-slate-900 text-slate-400 py-12 text-center">
            <div className="max-w-4xl mx-auto px-4">
                <p className="mb-4 font-serif text-lg text-slate-300">Daf Yomi Insights</p>
                <p className="text-sm mb-4">
                    Dedicated to providing interesting Daf Yomi articles and daily inspiration for the global community of learners.
                </p>
                <p className="text-sm">© {new Date().getFullYear()} Rabbi Avrohom Sebrow. All rights reserved.</p>
            </div>
        </footer>
        </body>
        </html>
    )
}
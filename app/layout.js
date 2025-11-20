import './globals.css'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import Search from './components/Search'

export const metadata = {
    title: 'Daf Yomi Articles & Insights | Rabbi Avrohom Sebrow | Delving into the Daf',
    description: 'Daf Yomi articles and deep insights the daily Daf.',
    verification: {
        google: 'TGCY40qeKGYZRzWKmdNNppBGhRa8qHlCIGzmzMMFvbY',
    },
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <body className="bg-slate-50 text-slate-900 font-serif antialiased">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold text-slate-900 tracking-tight hover:text-blue-700 transition flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                    <span className="hidden lg:inline">DafYomi<span className="text-blue-600">Insights</span></span>
                    <span className="lg:hidden">DY<span className="text-blue-600">Insights</span></span>
                </Link>

                {/* Nav Links */}
                <div className="flex items-center gap-4 md:gap-6 text-sm font-sans font-medium overflow-x-auto no-scrollbar">
                    {/* UPDATED: Renamed Link */}
                    <Link href="/daily" className="text-blue-600 font-bold hover:text-blue-800 transition whitespace-nowrap">
                        Daily Daf Discussion
                    </Link>

                    {/* NEW: Archive Link */}
                    <Link href="/daily/archive" className="text-slate-600 hover:text-blue-600 transition whitespace-nowrap">
                        Daf Discussion Archive
                    </Link>

                    <Link href="/masechtos" className="text-slate-600 hover:text-blue-600 transition hidden md:block">
                        Masechtos
                    </Link>

                    <Link href="/topics" className="text-slate-600 hover:text-blue-600 transition hidden md:block">
                        Topics
                    </Link>

                    <Link href="/contact" className="text-slate-600 hover:text-blue-600 transition hidden md:block">
                        Contact
                    </Link>

                    {/* Search Bar */}
                    <div className="hidden sm:block">
                        <Search />
                    </div>
                </div>

                {/* Mobile Search (Visible only on small screens) */}
                <div className="sm:hidden">
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
                <p className="text-sm">© {new Date().getFullYear()} Rabbi Avrohom Sebrow. All rights reserved.</p>
            </div>
        </footer>
        </body>
        </html>
    )
}
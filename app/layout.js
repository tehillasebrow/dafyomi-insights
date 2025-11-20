// app/layout.js
import './globals.css'
import Link from 'next/link'
import { Search, BookOpen } from 'lucide-react'

export const metadata = {
    title: 'Daf Yomi Insights | Rabbi Avrohom Sebrow',
    description: 'Deep insights into the daily Daf.',
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <body className="bg-slate-50 text-slate-900 font-serif antialiased">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-slate-900 tracking-tight hover:text-blue-700 transition">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                    <span>DafYomi<span className="text-blue-600">Insights</span></span>
                </Link>

                <div className="flex items-center gap-6 text-sm font-sans font-medium">
                    <Link href="/" className="text-slate-600 hover:text-blue-600">
                        Latest
                    </Link>
                    {/* Placeholder for future search functionality */}
                    <button className="text-slate-400 hover:text-blue-600">
                        <Search className="w-5 h-5" />
                    </button>
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
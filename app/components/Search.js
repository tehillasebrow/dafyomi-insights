'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { Search as SearchIcon, X, Loader2 } from 'lucide-react'

export default function Search() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)

    // Search Logic
    useEffect(() => {
        const searchArticles = async () => {
            if (query.length < 2) {
                setResults([])
                return
            }
            setLoading(true)

            // Search in title OR summary OR content using Postgres Full Text Search
            const { data, error } = await supabase
                .from('articles')
                .select('title, masechta, daf, summary')
                .textSearch('search_vector', `${query}:*`) // The :* allows partial matches
                .limit(5)

            if (!error) setResults(data || [])
            setLoading(false)
        }

        const timeoutId = setTimeout(searchArticles, 300) // Wait 300ms after typing stops
        return () => clearTimeout(timeoutId)
    }, [query])

    return (
        <div className="relative">
            {/* Search Icon Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="text-slate-400 hover:text-blue-600 transition p-2"
                >
                    <SearchIcon className="w-5 h-5" />
                </button>
            )}

            {/* Search Input Area */}
            {isOpen && (
                <div className="absolute right-0 top-[-10px] w-[300px] bg-white shadow-xl border border-slate-200 rounded-lg overflow-hidden z-50">
                    <div className="flex items-center px-3 border-b">
                        <SearchIcon className="w-4 h-4 text-slate-400 mr-2" />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search articles..."
                            className="w-full py-3 outline-none text-sm text-slate-700 placeholder:text-slate-400"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button onClick={() => {setIsOpen(false); setQuery('')}} className="p-1 hover:bg-slate-100 rounded-full">
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>

                    {/* Results Dropdown */}
                    {(results.length > 0 || loading) && (
                        <div className="max-h-[300px] overflow-y-auto bg-slate-50">
                            {loading && <div className="p-4 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto"/></div>}

                            {results.map((article) => (
                                <Link
                                    key={article.title}
                                    href={`/daf/${article.masechta.toLowerCase()}/${article.daf}`}
                                    onClick={() => setIsOpen(false)}
                                    className="block p-3 hover:bg-blue-50 border-b border-slate-100 transition"
                                >
                                    <div className="text-xs font-bold text-blue-600 uppercase">{article.masechta} {article.daf}</div>
                                    <div className="text-sm font-medium text-slate-900 truncate">{article.title}</div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {results.length === 0 && query.length > 2 && !loading && (
                        <div className="p-4 text-center text-xs text-slate-400">No results found.</div>
                    )}
                </div>
            )}
        </div>
    )
}
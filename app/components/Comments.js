'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Trash2, User, MessageSquare, Send } from 'lucide-react'

export default function Comments({ articleId }) {
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [author, setAuthor] = useState('')
    const [loading, setLoading] = useState(false)

    // Fetch Comments on Load
    useEffect(() => {
        fetchComments()
    }, [articleId])

    const fetchComments = async () => {
        const { data } = await supabase
            .from('comments')
            .select('*')
            .eq('article_id', articleId)
            .order('created_at', { ascending: false })

        if (data) setComments(data)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!newComment.trim() || !author.trim()) return

        setLoading(true)
        const { error } = await supabase
            .from('comments')
            .insert([{ article_id: articleId, author_name: author, content: newComment }])

        if (!error) {
            setNewComment('')
            fetchComments() // Refresh list
        }
        setLoading(false)
    }

    const handleDelete = async (id) => {
        const code = prompt("Enter Admin Access Code to delete:")
        // This matches the code in your Admin page logic (Check .env.local or hardcoded '1234')
        const adminCode = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234'

        if (code === adminCode) {
            await supabase.from('comments').delete().eq('id', id)
            fetchComments()
        } else {
            alert("❌ Wrong Code")
        }
    }

    return (
        <div className="mt-16 pt-8 border-t border-slate-200">
            <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                Comments ({comments.length})
            </h3>

            {/* Comment Form */}
            <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-xl mb-10 border border-slate-200">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Your Name"
                        required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Comment</label>
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Share your thoughts..."
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
                >
                    <Send className="w-4 h-4" /> {loading ? 'Posting...' : 'Post Comment'}
                </button>
            </form>

            {/* Comments List */}
            <div className="space-y-6">
                {comments.length === 0 && <p className="text-slate-500 italic">No comments yet. Be the first!</p>}

                {comments.map((c) => (
                    <div key={c.id} className="group flex gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="flex-grow">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-slate-900">{c.author_name}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</span>
                                    <button
                                        onClick={() => handleDelete(c.id)}
                                        className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition"
                                        title="Delete (Admin Only)"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
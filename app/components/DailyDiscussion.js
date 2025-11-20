'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { MessageCircle, Send, User, Trash2 } from 'lucide-react'

export default function DailyDiscussion({ dailyId }) {
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [author, setAuthor] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (dailyId) fetchComments()
    }, [dailyId])

    const fetchComments = async () => {
        const { data } = await supabase
            .from('daily_comments')
            .select('*')
            .eq('daily_id', dailyId)
            .order('created_at', { ascending: false })
        if (data) setComments(data)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!newComment.trim() || !author.trim()) return

        setLoading(true)
        const { error } = await supabase
            .from('daily_comments')
            .insert([{ daily_id: dailyId, author_name: author, content: newComment }])

        if (!error) {
            setNewComment('')
            fetchComments()
        }
        setLoading(false)
    }

    const handleDelete = async (id) => {
        const code = prompt("Enter Admin Access Code to delete:")
        const adminCode = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234'

        if (code === adminCode) {
            await supabase.from('daily_comments').delete().eq('id', id)
            fetchComments()
        } else {
            alert("❌ Wrong Code")
        }
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                Community Discussion
            </h3>

            {/* List */}
            <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2">
                {comments.length === 0 && <p className="text-slate-400 text-sm italic">No comments yet today. Start the discussion!</p>}
                {comments.map((c) => (
                    <div key={c.id} className="group flex gap-3 bg-slate-50 p-3 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold">
                            {c.author_name.charAt(0)}
                        </div>
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-bold text-slate-900">{c.author_name}</span>
                                <button
                                    onClick={() => handleDelete(c.id)}
                                    className="text-red-300 opacity-0 group-hover:opacity-100 hover:text-red-600 transition"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                            <p className="text-sm text-slate-700 mt-1">{c.content}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-4">
                <input
                    type="text"
                    placeholder="Your Name"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full text-sm p-2 border rounded bg-slate-50 focus:bg-white outline-none focus:border-blue-400 transition"
                    required
                />
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Add to the discussion..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-grow text-sm p-2 border rounded bg-slate-50 focus:bg-white outline-none focus:border-blue-400 transition"
                        required
                    />
                    <button disabled={loading} type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    )
}
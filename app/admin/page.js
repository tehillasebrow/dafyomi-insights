'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Save, Lock } from 'lucide-react'

export default function AdminPage() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    // Form Data
    const [accessCode, setAccessCode] = useState('')
    const [formData, setFormData] = useState({
        title: '',
        masechta: '',
        daf: '',
        summary: '',
        content: '',
        tags: ''
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        // 1. Simple Security Check (Change '1234' to whatever code you want)
        if (accessCode !== '1234') {
            setMessage('❌ Wrong Access Code')
            setLoading(false)
            return
        }

        // 2. Create the Slug automatically (e.g., "yoma-21-title")
        const slug = `${formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${formData.masechta.toLowerCase()}-${formData.daf}`

        // 3. Upload to Supabase
        const { error } = await supabase
            .from('articles')
            .insert([{
                title: formData.title,
                masechta: formData.masechta,
                daf: parseInt(formData.daf),
                summary: formData.summary,
                content: formData.content,
                slug: slug,
                tags: formData.tags.split(',').map(t => t.trim()) // Converts "tag1, tag2" to array
            }])

        if (error) {
            setMessage(`❌ Error: ${error.message}`)
        } else {
            setMessage('✅ Article Published Successfully!')
            // Clear form
            setFormData({ title: '', masechta: '', daf: '', summary: '', content: '', tags: '' })
        }
        setLoading(false)
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Lock className="w-6 h-6 text-blue-600" />
                Admin Upload
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">

                {/* Security Field */}
                <div>
                    <label className="block text-sm font-bold mb-2">Access Code</label>
                    <input
                        type="password"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-slate-50"
                        placeholder="Enter secret code"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Masechta</label>
                        <input
                            type="text"
                            value={formData.masechta}
                            onChange={(e) => setFormData({...formData, masechta: e.target.value})}
                            className="w-full p-2 border rounded-lg"
                            placeholder="e.g. Yoma"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Daf (Number)</label>
                        <input
                            type="number"
                            value={formData.daf}
                            onChange={(e) => setFormData({...formData, daf: e.target.value})}
                            className="w-full p-2 border rounded-lg"
                            placeholder="e.g. 21"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                        placeholder="Article Title"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Summary (SEO)</label>
                    <textarea
                        value={formData.summary}
                        onChange={(e) => setFormData({...formData, summary: e.target.value})}
                        className="w-full p-2 border rounded-lg h-20"
                        placeholder="Short description for Google..."
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({...formData, content: e.target.value})}
                        className="w-full p-2 border rounded-lg h-64 font-serif"
                        placeholder="Paste article text here..."
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                    <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({...formData, tags: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                        placeholder="Halacha, History, Shabbos"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                    {loading ? 'Uploading...' : <><Save className="w-4 h-4" /> Publish Article</>}
                </button>

                {message && (
                    <div className={`p-4 rounded-lg text-center font-bold ${message.includes('Error') || message.includes('Wrong') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {message}
                    </div>
                )}
            </form>
        </div>
    )
}
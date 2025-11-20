'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Save, Lock, Upload, Image as ImageIcon, Calendar } from 'lucide-react'

export default function AdminPage() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [accessCode, setAccessCode] = useState('')
    const [activeTab, setActiveTab] = useState('article') // 'article' or 'daily'

    // Article Form Data
    const [imageFile, setImageFile] = useState(null)
    const [articleData, setArticleData] = useState({
        title: '', masechta: '', daf: '', summary: '', content: '', tags: ''
    })

    // Daily Daf Form Data
    const [dailyData, setDailyData] = useState({
        date: new Date().toISOString().split('T')[0], // Default to today
        masechta: '',
        daf: '',
        topic_summary: ''
    })

    const checkSecurity = () => {
        const envPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD
        if (accessCode !== (envPassword )) {
            setMessage('❌ Wrong Access Code')
            return false
        }
        return true
    }

    const handleArticleSubmit = async (e) => {
        e.preventDefault()
        if(!checkSecurity()) return
        setLoading(true)
        setMessage('')

        // Image Upload
        let publicImageUrl = null
        if (imageFile) {
            const fileName = `${Date.now()}-${imageFile.name}`
            const { error: uploadError } = await supabase.storage.from('images').upload(fileName, imageFile)
            if (uploadError) { setMessage(`❌ Image Error: ${uploadError.message}`); setLoading(false); return }
            const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)
            publicImageUrl = urlData.publicUrl
        }

        const slug = `${articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${articleData.masechta.toLowerCase()}-${articleData.daf}`

        const { error } = await supabase.from('articles').insert([{
            title: articleData.title,
            masechta: articleData.masechta,
            daf: parseInt(articleData.daf),
            summary: articleData.summary,
            content: articleData.content,
            slug: slug,
            tags: articleData.tags.split(',').map(t => t.trim()),
            image_url: publicImageUrl
        }])

        if (error) setMessage(`❌ Error: ${error.message}`)
        else {
            setMessage('✅ Article Published!')
            setArticleData({ title: '', masechta: '', daf: '', summary: '', content: '', tags: '' })
            setImageFile(null)
        }
        setLoading(false)
    }

    const handleDailySubmit = async (e) => {
        e.preventDefault()
        if(!checkSecurity()) return
        setLoading(true)
        setMessage('')

        const { error } = await supabase.from('daily_discussions').insert([{
            date: dailyData.date,
            masechta: dailyData.masechta,
            daf: parseInt(dailyData.daf),
            topic_summary: dailyData.topic_summary
        }])

        if (error) setMessage(`❌ Error: ${error.message}`)
        else {
            setMessage('✅ Daily Daf Updated!')
            setDailyData({ ...dailyData, topic_summary: '' })
        }
        setLoading(false)
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Lock className="w-6 h-6 text-blue-600" /> Admin Portal
            </h1>

            {/* Access Code (Global) */}
            <div className="mb-8">
                <label className="block text-sm font-bold mb-2">Access Code</label>
                <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="w-full p-3 border rounded-lg bg-slate-50" placeholder="Enter secret code" required />
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1">
                <button onClick={() => setActiveTab('article')} className={`pb-2 px-1 font-bold transition ${activeTab === 'article' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Upload Article</button>
                <button onClick={() => setActiveTab('daily')} className={`pb-2 px-1 font-bold transition ${activeTab === 'daily' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Set Daily Daf</button>
            </div>

            {/* Messages */}
            {message && (
                <div className={`p-4 mb-6 rounded-lg text-center font-bold ${message.includes('Error') || message.includes('Wrong') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {message}
                </div>
            )}

            {/* Article Form */}
            {activeTab === 'article' && (
                <form onSubmit={handleArticleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <label className="block text-sm font-bold mb-2 text-blue-900 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Article Image (Optional)</label>
                        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Masechta</label><input type="text" value={articleData.masechta} onChange={(e) => setArticleData({...articleData, masechta: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g. Pesachim" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Daf</label><input type="number" value={articleData.daf} onChange={(e) => setArticleData({...articleData, daf: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g. 100" required /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Title</label><input type="text" value={articleData.title} onChange={(e) => setArticleData({...articleData, title: e.target.value})} className="w-full p-2 border rounded-lg" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Summary</label><textarea value={articleData.summary} onChange={(e) => setArticleData({...articleData, summary: e.target.value})} className="w-full p-2 border rounded-lg h-20" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Content</label><textarea value={articleData.content} onChange={(e) => setArticleData({...articleData, content: e.target.value})} className="w-full p-2 border rounded-lg h-64 font-serif" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Tags</label><input type="text" value={articleData.tags} onChange={(e) => setArticleData({...articleData, tags: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">{loading ? 'Uploading...' : <><Save className="w-4 h-4" /> Publish Article</>}</button>
                </form>
            )}

            {/* Daily Daf Form */}
            {activeTab === 'daily' && (
                <form onSubmit={handleDailySubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg border-b pb-2">Update Today's Learning</h3>
                    <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" value={dailyData.date} onChange={(e) => setDailyData({...dailyData, date: e.target.value})} className="w-full p-2 border rounded-lg" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Masechta</label><input type="text" value={dailyData.masechta} onChange={(e) => setDailyData({...dailyData, masechta: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g. Bava Batra" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Daf</label><input type="number" value={dailyData.daf} onChange={(e) => setDailyData({...dailyData, daf: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g. 22" required /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Discussion Topic (Optional)</label><textarea value={dailyData.topic_summary} onChange={(e) => setDailyData({...dailyData, topic_summary: e.target.value})} className="w-full p-2 border rounded-lg h-24" placeholder="e.g. Discussing the case of the stolen ox..." /></div>
                    <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2">{loading ? 'Updating...' : <><Calendar className="w-4 h-4" /> Set Daily Daf</>}</button>
                </form>
            )}
        </div>
    )
}
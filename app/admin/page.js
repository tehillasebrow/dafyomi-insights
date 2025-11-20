'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Save, Lock, Upload, Image as ImageIcon } from 'lucide-react'

export default function AdminPage() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    // Form Data
    const [accessCode, setAccessCode] = useState('')
    const [imageFile, setImageFile] = useState(null) // New State for Image
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

        // 1. Security Check
        const envPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD
        if (accessCode !== (envPassword || '1234')) {
            setMessage('❌ Wrong Access Code')
            setLoading(false)
            return
        }

        // 2. Image Upload Logic
        let publicImageUrl = null
        if (imageFile) {
            const fileName = `${Date.now()}-${imageFile.name}`
            const { data, error: uploadError } = await supabase.storage
                .from('images')
                .upload(fileName, imageFile)

            if (uploadError) {
                setMessage(`❌ Image Upload Failed: ${uploadError.message}`)
                setLoading(false)
                return
            }

            // Get Public URL
            const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)
            publicImageUrl = urlData.publicUrl
        }

        // 3. Create Slug
        const slug = `${formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${formData.masechta.toLowerCase()}-${formData.daf}`

        // 4. Upload Article to DB
        const { error } = await supabase
            .from('articles')
            .insert([{
                title: formData.title,
                masechta: formData.masechta,
                daf: parseInt(formData.daf),
                summary: formData.summary,
                content: formData.content,
                slug: slug,
                tags: formData.tags.split(',').map(t => t.trim()),
                image_url: publicImageUrl // Save the image URL
            }])

        if (error) {
            setMessage(`❌ Database Error: ${error.message}`)
        } else {
            setMessage('✅ Article & Image Published Successfully!')
            setFormData({ title: '', masechta: '', daf: '', summary: '', content: '', tags: '' })
            setImageFile(null)
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

                {/* Image Upload Field */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-sm font-bold mb-2 text-blue-900 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Article Image (Optional)
                    </label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files[0])}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition"
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
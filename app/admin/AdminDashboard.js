'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Save, Image as ImageIcon, Calendar, LogOut, BookOpen } from 'lucide-react'
import { createArticle, createStory, createDailyDiscussion, logout } from './actions'
import VisitorLog from './VisitorLog'
import MailingList from './MailingList'

const today = () => new Date().toISOString().split('T')[0]

// Submit via onSubmit rather than <form action> so React doesn't auto-reset
// the form (and lose a long article) when the action returns an error.
const submitWith = (action) => (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => action(formData))
}

function Message({ state }) {
    const text = state?.error || state?.success
    if (!text) return null
    return (
        <div className={`p-4 mb-6 rounded-lg text-center font-bold ${state.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {text}
            {state.path && <> <Link href={state.path} className="underline">View it</Link></>}
        </div>
    )
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('article') // 'article', 'daily' or 'visitors'
    const [articleState, articleAction, articlePending] = useActionState(createArticle, {})
    const [dailyState, dailyAction, dailyPending] = useActionState(createDailyDiscussion, {})
    const [storyState, storyAction, storyPending] = useActionState(createStory, {})
    const [standalone, setStandalone] = useState(false) // "Beyond the Daf": an article that isn't on a daf
    const articleForm = useRef(null)
    const storyForm = useRef(null)

    useEffect(() => {
        if (articleState?.success) articleForm.current?.reset()
    }, [articleState])

    useEffect(() => {
        if (storyState?.success) storyForm.current?.reset()
    }, [storyState])

    return (
        <>
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1">
                <button onClick={() => setActiveTab('article')} className={`pb-2 px-1 font-bold transition ${activeTab === 'article' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Upload Article</button>
                <button onClick={() => setActiveTab('story')} className={`pb-2 px-1 font-bold transition ${activeTab === 'story' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Add Story</button>
                <button onClick={() => setActiveTab('daily')} className={`pb-2 px-1 font-bold transition ${activeTab === 'daily' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Set Daily Daf</button>
                <button onClick={() => setActiveTab('visitors')} className={`pb-2 px-1 font-bold transition ${activeTab === 'visitors' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Visitors</button>
                <button onClick={() => setActiveTab('mailing')} className={`pb-2 px-1 font-bold transition ${activeTab === 'mailing' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Mailing List</button>
                <form action={logout} className="ml-auto">
                    <button type="submit" className="pb-2 px-1 text-sm text-slate-400 hover:text-red-600 transition flex items-center gap-1"><LogOut className="w-4 h-4" /> Log out</button>
                </form>
            </div>

            {/* Article Form */}
            {activeTab === 'article' && (
                <>
                    <Message state={articleState} />
                    <form ref={articleForm} onSubmit={submitWith(articleAction)} onReset={() => setStandalone(false)} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <label className="block text-sm font-bold mb-2 text-blue-900 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Article Image (Optional)</label>
                            <input type="file" name="image" accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition" />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <input type="checkbox" name="standalone" checked={standalone} onChange={e => setStandalone(e.target.checked)} className="w-4 h-4" />
                            Beyond the Daf (not on a daf): a tribute, interview or other writing
                        </label>
                        {!standalone && (
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Masechta</label><input type="text" name="masechta" className="w-full p-2 border rounded-lg" placeholder="e.g. Pesachim" required /></div>
                                <div><label className="block text-sm font-medium mb-1">Daf</label><input type="number" name="daf" min="2" className="w-full p-2 border rounded-lg" placeholder="e.g. 100" required /></div>
                                <div><label className="block text-sm font-medium mb-1">Through Daf (Optional)</label><input type="number" name="daf_end" min="2" className="w-full p-2 border rounded-lg" placeholder="e.g. 102" /></div>
                            </div>
                        )}
                        <div><label className="block text-sm font-medium mb-1">Title</label><input type="text" name="title" className="w-full p-2 border rounded-lg" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Published Date</label><input type="date" name="published_at" defaultValue={today()} className="w-full p-2 border rounded-lg" /></div>
                        <div><label className="block text-sm font-medium mb-1">Summary</label><textarea name="summary" className="w-full p-2 border rounded-lg h-20" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Content</label><textarea name="content" className="w-full p-2 border rounded-lg h-64 font-serif" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Tags</label><input type="text" name="tags" className="w-full p-2 border rounded-lg" /></div>
                        <button type="submit" disabled={articlePending} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">{articlePending ? 'Uploading...' : <><Save className="w-4 h-4" /> Publish Article</>}</button>
                    </form>
                </>
            )}

            {/* Story Form: most stories come from the story pipeline; this is for adding one by hand */}
            {activeTab === 'story' && (
                <>
                    <Message state={storyState} />
                    <form ref={storyForm} onSubmit={submitWith(storyAction)} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <p className="text-sm text-slate-500">Each story gets its own page so people can find it on Google. Copy the story text exactly from the article so it links to the right spot.</p>
                        <div><label className="block text-sm font-medium mb-1">Article Link</label><input type="url" name="article_url" className="w-full p-2 border rounded-lg" placeholder="https://dafyomiinsights.com/daf/bava-metzia/59/... or /beyond-the-daf/..." required /></div>
                        <div><label className="block text-sm font-medium mb-1">Story Name</label><input type="text" name="title" className="w-full p-2 border rounded-lg" placeholder="e.g. The Oven of Achnai" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Summary (1–2 sentences, shown on Google)</label><textarea name="summary" maxLength={300} className="w-full p-2 border rounded-lg h-20" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Story Text</label><textarea name="content" className="w-full p-2 border rounded-lg h-48 font-serif" required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Sages (comma separated)</label><input type="text" name="people" className="w-full p-2 border rounded-lg" placeholder="e.g. Rabbi Eliezer, Rabbi Yehoshua" /></div>
                            <div><label className="block text-sm font-medium mb-1">Tags (comma separated)</label><input type="text" name="tags" className="w-full p-2 border rounded-lg" placeholder="e.g. Machlokes, Truth" /></div>
                        </div>
                        <button type="submit" disabled={storyPending} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">{storyPending ? 'Publishing...' : <><BookOpen className="w-4 h-4" /> Publish Story</>}</button>
                    </form>
                </>
            )}

            {/* Daily Daf Form */}
            {activeTab === 'daily' && (
                <>
                    <Message state={dailyState} />
                    <form onSubmit={submitWith(dailyAction)} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-lg border-b pb-2">Update Today&apos;s Learning</h3>
                        <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" name="date" defaultValue={today()} className="w-full p-2 border rounded-lg" required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Masechta</label><input type="text" name="masechta" className="w-full p-2 border rounded-lg" placeholder="e.g. Bava Batra" required /></div>
                            <div><label className="block text-sm font-medium mb-1">Daf</label><input type="number" name="daf" className="w-full p-2 border rounded-lg" placeholder="e.g. 22" required /></div>
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Discussion Topic (Optional)</label><textarea name="topic_summary" className="w-full p-2 border rounded-lg h-24" placeholder="e.g. Discussing the case of the stolen ox..." /></div>
                        <button type="submit" disabled={dailyPending} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2">{dailyPending ? 'Updating...' : <><Calendar className="w-4 h-4" /> Set Daily Daf</>}</button>
                    </form>
                </>
            )}

            {activeTab === 'visitors' && <VisitorLog />}

            {activeTab === 'mailing' && <MailingList />}
        </>
    )
}

import { Mail, MapPin } from 'lucide-react'

export const metadata = {
    title: 'Contact Rabbi Sebrow | Daf Yomi Insights',
}

export default function ContactPage() {
    return (
        <div className="max-w-2xl mx-auto px-4 py-16">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-6">Contact Rabbi Sebrow</h1>
                <p className="text-slate-600 mb-8 leading-relaxed">
                    Have a question about the Daf? Interested in joining the Chaburah?
                    <br/>Feel free to reach out directly.
                </p>

                <div className="space-y-6">
                    <a
                        href="mailto:asebrow@gmail.com"
                        className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition group"
                    >
                        <div className="bg-blue-600 text-white p-2 rounded-full group-hover:scale-110 transition">
                            <Mail className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-medium text-blue-900">ASebrow@gmail.com</span>
                    </a>

                    <div className="border-t border-slate-100 pt-6 mt-6">
                        <div className="flex items-center justify-center gap-2 text-slate-500 mb-2">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm font-bold uppercase tracking-wide">Chaburah Location</span>
                        </div>
                        <p className="text-slate-800 font-medium">
                            Eitz Chayim of Dogwood Park<br/>
                            West Hempstead, NY
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
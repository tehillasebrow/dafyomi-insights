import { Mail, MapPin, User } from 'lucide-react'

export const metadata = {
    title: 'Contact Rabbi Sebrow | Daf Yomi Insights',
}

export default function ContactPage() {
    return (
        <div className="max-w-3xl mx-auto px-4 py-16">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                <h1 className="text-4xl font-bold text-slate-900 mb-8">Contact Rabbi Sebrow</h1>

                {/* Bio Section */}
                <div className="mb-10 text-left bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        About Rabbi Avrohom Sebrow
                    </h2>
                    <div className="space-y-4 text-slate-700 leading-relaxed">
                        <p>
                            Rabbi Avrohom Sebrow is a  Maggid Shiur and writer for The Jewish Home where he writes a weekly article <bold>Delving into the Daf</bold>.
                        </p>
                        <p>
                            He currently serves as a Rebbe at <span className="font-semibold text-slate-900">Yeshiva Ateres Shimon</span> in Far Rockaway, where he inspires students through his engaging shiurim.
                        </p>
                        <p>
                            In addition to his role at the Yeshiva, Rabbi Sebrow leads a vibrant <span className="font-semibold text-slate-900">Daf Yomi Chaburah</span> at Eitz Chayim of Dogwood Park in West Hempstead, NY. His articles, known for blending practical Halacha with historical context and Mussar, are widely read and appreciated by the Torah community.
                        </p>
                    </div>
                </div>

                <p className="text-slate-600 mb-8 leading-relaxed font-medium">
                    Have a question about the Daf? Interested in joining the Chaburah?
                    <br/>Feel free to reach out directly.
                </p>

                <div className="space-y-6">
                    <a
                        href="mailto:asebrow@gmail.com"
                        className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition group border border-blue-100"
                    >
                        <div className="bg-blue-600 text-white p-2 rounded-full group-hover:scale-110 transition shadow-sm">
                            <Mail className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-blue-900">ASebrow@gmail.com</span>
                    </a>

                    <div className="border-t border-slate-100 pt-8 mt-8">
                        <div className="flex items-center justify-center gap-2 text-slate-500 mb-3">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Chaburah Location</span>
                        </div>
                        <p className="text-slate-800 font-medium text-lg">
                            Eitz Chayim of Dogwood Park<br/>
                            <span className="text-slate-500 text-base font-normal">West Hempstead, NY</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
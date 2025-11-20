import Link from 'next/link'
import { Book } from 'lucide-react'

// The complete list of Bavli Masechtos organized by Seder
const sedarim = [
    { name: 'Zeraim', masechtos: ['Berachos'] },
    { name: 'Moed', masechtos: ['Shabbos', 'Eruvin', 'Pesachim', 'Shekalim', 'Yoma', 'Sukkah', 'Beitzah', 'Rosh Hashanah', 'Taanis', 'Megillah', 'Moed Katan', 'Chagigah'] },
    { name: 'Nashim', masechtos: ['Yevamos', 'Kesubos', 'Nedarim', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin'] },
    { name: 'Nezikin', masechtos: ['Bava Kamma', 'Bava Metzia', 'Bava Basra', 'Sanhedrin', 'Makkos', 'Shevuos', 'Eduyos', 'Avodah Zarah', 'Avos', 'Horayos'] },
    { name: 'Kodashim', masechtos: ['Zevachim', 'Menachos', 'Chullin', 'Bechoros', 'Arachin', 'Temurah', 'Kerisus', 'Meilah', 'Tamid', 'Middos', 'Kinnim'] },
    { name: 'Taharos', masechtos: ['Niddah'] }
]

export const metadata = {
    title: 'All Masechtos | Daf Yomi Insights',
    description: 'Index of all Talmudic tractates.',
}

export default function MasechtosPage() {
    return (
        <div className="max-w-6xl mx-auto px-4 py-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-12 text-center">Browse by Masechta</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sedarim.map((seder) => (
                    <div key={seder.name} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                            <Book className="w-5 h-5 text-blue-600" /> Seder {seder.name}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {seder.masechtos.map((masechta) => (
                                <Link
                                    key={masechta}
                                    href={`/daf/${masechta.toLowerCase()}`}
                                    className="px-3 py-1.5 bg-slate-50 text-slate-700 text-sm rounded hover:bg-blue-600 hover:text-white transition"
                                >
                                    {masechta}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
import { buildMetadata } from '@/app/lib/seo'
import { AUTHOR } from '@/app/lib/site'
import { AuthorPlate } from '@/app/components/Author'
import CopyText from '@/app/components/CopyText'

export const metadata = buildMetadata({
    title: 'About & Contact Rabbi Avrohom Sebrow',
    description: 'About Rabbi Avrohom Sebrow, maggid shiur and author of Delving into the Daf, and how to reach him or join his Daf Yomi chaburah in West Hempstead.',
    path: '/contact',
})

export default function ContactPage() {
    return (
        <div className="folio py-8 md:py-12">
            <div className="grid gap-7 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-10">
                <AuthorPlate size="lg" />
                <div className="grid gap-5 content-start">
                    <div>
                        <p className="sc">About the author</p>
                        <h1 className="font-semibold text-[clamp(2.1rem,5vw,3.4rem)] leading-none tracking-[-0.02em]">{AUTHOR.name}</h1>
                    </div>
                    <div className="grid gap-3.5 text-read max-w-[58ch]">
                        <p>Rabbi Avrohom Sebrow is a maggid shiur and writes <i>{AUTHOR.column}</i> each week for The Jewish Home.</p>
                        <p>He is a Rebbe at Yeshiva Ateres Shimon in Far Rockaway, and leads a Daf Yomi chaburah at Eitz Chayim of Dogwood Park in West Hempstead, NY. His articles bring together practical halacha, history and mussar.</p>
                        <p>Have a question on the Daf, or interested in joining the chaburah? Write to him directly.</p>
                    </div>
                    <dl className="grid border-t border-rule-hard">
                        <div className="grid gap-1 py-3 border-b border-rule sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-3">
                            <dt className="sc">Write to him</dt>
                            <dd className="flex flex-wrap items-center gap-2 text-[1.12rem]">
                                <a href={`mailto:${AUTHOR.email}`}>ASebrow@gmail.com</a>
                                <CopyText text={AUTHOR.email} label="Copy address" />
                            </dd>
                        </div>
                        <div className="grid gap-1 py-3 border-b border-rule sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-3">
                            <dt className="sc">Chaburah</dt>
                            <dd className="text-[1.12rem]">Eitz Chayim of Dogwood Park, West Hempstead, NY</dd>
                        </div>
                        <div className="grid gap-1 py-3 border-b border-rule sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-3">
                            <dt className="sc">Column</dt>
                            <dd className="text-[1.12rem]">{AUTHOR.column}, The Jewish Home</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    )
}

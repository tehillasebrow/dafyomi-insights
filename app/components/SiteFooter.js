import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import { AUTHOR } from '@/app/lib/site'

const COLUMNS = [
    ['Read', [
        ['/articles', 'All articles'],
        ['/stories', 'Gemara stories'],
        ['/people', 'Stories by sage'],
        ['/daily', "Today's Daf"],
    ]],
    ['Find', [
        ['/masechtos', 'Masechtos'],
        ['/topics', 'Topics'],
        ['/daily/archive', 'Past discussions'],
        ['/contact', 'About and contact'],
    ]],
]

export default function SiteFooter() {
    return (
        <footer data-site className="on-binding mt-16">
            <div className="folio grid gap-6 py-8 md:grid-cols-[1.3fr_1fr_1fr]">
                <div className="grid gap-3 content-start">
                    <b className="text-[1.25rem]">Daf Yomi Insights</b>
                    <p className="note">Weekly insights on the Daf by {AUTHOR.name}, from his column “{AUTHOR.column}” in The Jewish Home.</p>
                    <div><ThemeToggle /></div>
                </div>
                {COLUMNS.map(([title, links]) => (
                    <nav key={title} aria-label={title} className="grid content-start">
                        <span className="sc">{title}</span>
                        {links.map(([href, label]) => (
                            <Link key={href} href={href} className="min-h-11 flex items-center decoration-binding-soft">{label}</Link>
                        ))}
                    </nav>
                ))}
                <p className="meta md:col-span-3">© {new Date().getFullYear()} {AUTHOR.name}. All rights reserved.</p>
            </div>
        </footer>
    )
}

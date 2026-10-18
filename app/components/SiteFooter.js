import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import SubscribeForm from './SubscribeForm'
import { AUTHOR } from '@/app/lib/site'

const COLUMNS = [
    ['Read', [
        ['/articles', 'All articles'],
        ['/beyond-the-daf', 'Beyond the Daf'],
        ['/stories', 'Gemara stories'],
        ['/people', 'Stories by sage'],
        ['/daily', "Today's Daf"],
        ['/calendar', 'Daf Yomi calendar'],
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
                <section aria-labelledby="footer-subscribe" className="grid gap-2 md:col-span-3 border-t border-[var(--binding-line)] pt-6 md:grid-cols-[1.3fr_2fr] md:gap-6 md:items-center">
                    <div className="grid gap-1">
                        <b id="footer-subscribe" className="text-[1.125rem]">Get each new article by email</b>
                        <p className="note">Free, once a week when the column comes out. Unsubscribe anytime.</p>
                    </div>
                    <SubscribeForm source="footer" onBinding />
                </section>
                <p className="meta md:col-span-3">© {new Date().getFullYear()} {AUTHOR.name}. All rights reserved.</p>
            </div>
        </footer>
    )
}

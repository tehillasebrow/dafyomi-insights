import Logo from './Logo'
import NavLinks from './NavLinks'
import Search from './Search'
import MobileMenu from './MobileMenu'
import TodayStrip from './TodayStrip'

export default function SiteHeader() {
    return (
        <header data-site className="bg-paper border-b-2 border-ink">
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:p-3 focus:bg-paper">Skip to content</a>
            <div className="folio flex items-center justify-between gap-3 py-2.5">
                <Logo />
                <NavLinks />
                <div className="flex items-center gap-1.5">
                    <Search />
                    <MobileMenu />
                </div>
            </div>
            <TodayStrip />
        </header>
    )
}

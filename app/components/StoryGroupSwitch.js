import Link from 'next/link'

// "By masechta | By sage" switch shared by /stories and /people
export default function StoryGroupSwitch({ current }) {
    const item = 'plain min-h-11 inline-flex items-center px-3.5 aria-[current=page]:bg-ink aria-[current=page]:text-paper'
    return (
        <div role="group" aria-label="Group stories" className="inline-flex border border-ink rounded-[2px]">
            <Link href="/stories" aria-current={current === 'masechta' ? 'page' : undefined} className={item}>By masechta</Link>
            <Link href="/people" aria-current={current === 'sage' ? 'page' : undefined} className={item}>By person</Link>
        </div>
    )
}

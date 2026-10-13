import UnsubscribeForm from './UnsubscribeForm'

export const metadata = {
    title: 'Unsubscribe',
    robots: { index: false, follow: false },
}

export default async function UnsubscribePage({ searchParams }) {
    const { token } = await searchParams

    return (
        <div className="folio max-w-xl py-12 grid gap-6">
            <h1 className="text-[2rem] font-semibold leading-tight">Unsubscribe</h1>
            {typeof token === 'string' && token
                ? <UnsubscribeForm token={token} />
                : <p className="note">Use the unsubscribe link at the bottom of any of our emails.</p>}
        </div>
    )
}

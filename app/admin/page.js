import { Lock } from 'lucide-react'
import { isAdmin } from '@/app/lib/adminAuth'
import LoginForm from './LoginForm'
import AdminDashboard from './AdminDashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Admin',
    robots: { index: false, follow: false },
}

export default async function AdminPage() {
    const loggedIn = await isAdmin()

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Lock className="w-6 h-6 text-blue-600" /> Admin Portal
            </h1>
            {loggedIn ? <AdminDashboard /> : <LoginForm />}
        </div>
    )
}

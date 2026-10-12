// lib/adminAuth.js
// Admin session: an httpOnly cookie holding "<expiry>.<hmac>", signed with a
// server-only secret. Changing ADMIN_PASSWORD invalidates every session.
import 'server-only'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export const ADMIN_COOKIE = 'admin_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret() {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD
    if (!secret) throw new Error('ADMIN_PASSWORD is not set')
    return secret
}

function sign(value) {
    return createHmac('sha256', getSecret()).update(value).digest('hex')
}

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a))
    const bufB = Buffer.from(String(b))
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export function checkPassword(input) {
    const password = process.env.ADMIN_PASSWORD
    if (!password || typeof input !== 'string') return false
    // Compare HMACs so the comparison is constant-time regardless of length
    return safeEqual(sign(`pw:${input}`), sign(`pw:${password}`))
}

export async function createAdminSession() {
    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS
    const token = `${expires}.${sign(`admin:${expires}`)}`
    const store = await cookies()
    store.set(ADMIN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_SECONDS,
    })
}

export async function clearAdminSession() {
    const store = await cookies()
    store.delete(ADMIN_COOKIE)
}

export async function isAdmin() {
    const store = await cookies()
    const token = store.get(ADMIN_COOKIE)?.value
    if (!token) return false

    const [expires, signature] = token.split('.')
    if (!expires || !signature) return false
    if (Number(expires) < Math.floor(Date.now() / 1000)) return false

    try {
        return safeEqual(signature, sign(`admin:${expires}`))
    } catch {
        return false
    }
}

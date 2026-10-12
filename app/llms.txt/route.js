import { buildLlmsTxt } from '@/app/lib/llms'

export const revalidate = 3600

export async function GET() {
    return new Response(await buildLlmsTxt(), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
}

export default function manifest() {
    return {
        name: 'Daf Yomi Insights',
        short_name: 'Daf Insights',
        description: 'Daf Yomi articles and insights by Rabbi Avrohom Sebrow.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f7f3',
        theme_color: '#17181c',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
    }
}

// Everything here is interactive (WebSockets, audio, localStorage), so the pages render on the client.
// Nitro still does the full-stack part: it serves the app and runs the WebSocket relay in server/.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  nitro: { experimental: { websocket: true } },
  // Pre-bundle Phaser so the dev server doesn't stop and reload the page the first time Fox Hunt starts.
  vite: {
    optimizeDeps: { include: ['phaser'] },
    // Phaser is one ~1.4 MB chunk, loaded only when a Phaser game starts.
    build: { chunkSizeWarningLimit: 1500 },
  },
  app: {
    head: {
      title: 'JOTA-JOTI Games',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'theme-color', content: '#10231a' }],
      link: [{ rel: 'icon', href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📻</text></svg>" }],
    },
  },
  typescript: { strict: true },
});

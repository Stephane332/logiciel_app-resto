import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Savora — Commander',
        short_name: 'Savora',
        description: 'Commandez, payez et suivez votre commande. Livraison, retrait ou sur place.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        /*
         * Les couleurs de l'écran de démarrage et de la barre d'état.
         *
         * Elles portaient encore le vert nuit de l'ancienne direction visuelle : l'application
         * s'ouvrait sur un écran sombre avant d'afficher une interface claire, et la barre d'état
         * Android restait foncée par-dessus. Un clignotement sombre au lancement fait croire à un
         * défaut d'affichage, et c'est la première chose que voit un client.
         */
        background_color: '#fbf8f3',
        theme_color: '#fbf8f3',
        categories: ['food', 'shopping'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Menu', url: '/menu', description: 'Voir la carte' },
          { name: 'Mes commandes', url: '/commandes', description: 'Suivre mes commandes' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Ne jamais servir une page mise en cache à la place d'une réponse d'API. Les photos sont
        // servies sous ce même préfixe, et sont donc couvertes par la même exclusion : sans elle,
        // une image demandée hors ligne recevrait le HTML de l'application, et le navigateur
        // afficherait une image cassée sans rien dire de plus.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Le menu reste consultable sans réseau après une première visite (critère A14).
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/v1/menu') || url.pathname.startsWith('/api/v1/restaurant'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'savora-menu',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Les images sont l'élément le plus lourd : sur des données comptées, elles ne se
            // téléchargent qu'une fois.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'savora-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/realtime': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  // Même redirection en prévisualisation : c'est le seul mode où le service worker est actif, donc
  // le seul où l'on peut vérifier le fonctionnement hors ligne avant la mise en production.
  preview: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/realtime': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Le noyau React change rarement : le séparer évite de retélécharger 45 Ko à chaque
        // correction de l'application.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});

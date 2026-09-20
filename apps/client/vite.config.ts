import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Base de l'application.
 *
 * À la racine du domaine dans le cas normal — le restaurant sert l'application sur son propre nom.
 * Sous un sous-chemin quand elle est déposée sur un hébergeur de fichiers statiques comme GitHub
 * Pages, qui sert chaque dépôt sous son nom : `/logiciel_app-resto/`.
 *
 * Tout en découle : les chemins des scripts, le périmètre du service worker, le point de départ du
 * manifeste et le `basename` du routeur. Un seul réglage, sinon quatre occasions de se tromper.
 */
const BASE = process.env.VITE_BASE ?? '/';

/**
 * Le repli des hébergeurs de fichiers statiques.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un hébergeur de fichiers ne connaît pas les adresses d'une application.      │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * `…/menu` n'est pas un fichier : c'est une route que le routeur résout dans le navigateur. Un
 * serveur d'application le sait et renvoie `index.html` pour toute adresse inconnue. GitHub Pages,
 * Netlify et les autres ne le savent pas : ils cherchent le fichier, ne le trouvent pas, et servent
 * leur propre page « 404 ».
 *
 * Le service worker corrige cela — mais seulement à partir de la deuxième visite, puisqu'il faut
 * d'abord qu'il s'installe. Or la première visite est précisément celle qui compte : c'est le lien
 * partagé sur WhatsApp, le lien d'un plat envoyé à un ami, l'adresse rouverte depuis l'écran
 * d'accueil. Elle tomberait sur la page d'erreur de l'hébergeur.
 *
 * Ces hébergeurs servent toutefois `404.html` quand il existe. En y déposant une copie de la page
 * d'accueil, l'application démarre normalement et son routeur affiche la bonne vue. Le code de
 * réponse reste 404, ce qui est sans effet sur ce que voit l'utilisateur.
 */
function repliStatique(): Plugin {
  return {
    name: 'savora-repli-404',
    apply: 'build',
    async closeBundle() {
      const dist = join(import.meta.dirname, 'dist');
      await copyFile(join(dist, 'index.html'), join(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: BASE,
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
        // Le manifeste suit la base : un `start_url` à la racine ouvrirait le domaine de l'hébergeur
        // au lieu de l'application, et l'icône installée mènerait à une page blanche.
        start_url: BASE,
        scope: BASE,
        id: BASE,
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
        /*
         * Icônes et raccourcis suivent la base, eux aussi.
         *
         * Vite réécrit les adresses de la page, mais pas celles que l'on écrit soi-même dans le
         * manifeste. Laissées à la racine, elles pointaient vers `https://hebergeur/icon-192.png` —
         * une adresse qui n'existe pas quand l'application vit sous un sous-chemin. L'icône installée
         * sur l'écran d'accueil aurait été vide, et les raccourcis auraient mené hors de
         * l'application. Deux défauts qu'on ne découvre qu'une fois le téléphone en main.
         */
        icons: [
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Menu', url: `${BASE}menu`, description: 'Voir la carte' },
          { name: 'Mes commandes', url: `${BASE}commandes`, description: 'Suivre mes commandes' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
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
    repliStatique(),
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

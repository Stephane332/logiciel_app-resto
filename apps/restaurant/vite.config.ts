import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /*
   * Chemins relatifs dans la construction.
   *
   * L'application Windows charge cette interface depuis un fichier local : une adresse commençant
   * par « / » y désignerait la racine du disque, et rien ne se chargerait — page blanche, sans la
   * moindre erreur visible. Servie par un serveur web, une adresse relative fonctionne tout aussi
   * bien : il n'y a donc rien à arbitrer.
   */
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/realtime': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/realtime': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
});

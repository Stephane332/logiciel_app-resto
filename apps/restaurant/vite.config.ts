import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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

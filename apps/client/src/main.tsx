import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { queryClient } from './lib/queries';
import './lib/session';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        * `basename` suit la base de construction.
        *
        * Déposée sur GitHub Pages, l'application vit sous « /logiciel_app-resto/ » et non à la racine
        * du domaine. Sans cela le routeur ne reconnaîtrait aucune de ses propres adresses : la page
        * s'ouvrirait sur l'écran « introuvable », et le défaut ne se verrait qu'après le déploiement.
        */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

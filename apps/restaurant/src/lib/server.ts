/**
 * Adresse du serveur du restaurant.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  L'adresse se règle à l'exécution, jamais à la compilation.                  │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le même logiciel tourne dans trois situations qui n'ont pas la même adresse de serveur :
 *
 *   — **dans un navigateur**, servi par le même domaine que l'API : une adresse relative suffit ;
 *   — **en application Windows**, installée sur le poste de caisse : le serveur est ailleurs, sur
 *     un VPS, et son adresse n'est connue qu'au moment de l'installation chez le restaurateur ;
 *   — **en développement**, où tout vit sur la machine.
 *
 * Figer l'adresse à la compilation obligerait à produire un exe différent par restaurant. C'est
 * exactement le genre de détail qui transforme un produit vendable en travail sur mesure : à la
 * dixième installation, il faudrait dix binaires à maintenir. L'exe est donc unique, et demande son
 * serveur au premier lancement.
 */

declare global {
  interface Window {
    /** Injecté par l'application Windows avant le chargement de la page. */
    __SAVORA_SERVER__?: string;
  }
}

/** Racine du serveur, sans barre oblique finale. « » en navigateur : l'origine courante suffit. */
export function serverOrigin(): string {
  const injected = typeof window !== 'undefined' ? window.__SAVORA_SERVER__ : undefined;
  if (injected) return injected.replace(/\/+$/, '');
  return '';
}

/** Base des appels d'API. */
export function apiBase(): string {
  const origin = serverOrigin();
  if (origin) return `${origin}/api/v1`;
  return import.meta.env.VITE_API_URL || '/api/v1';
}

/** Origine du canal temps réel. */
export function realtimeOrigin(): string {
  const origin = serverOrigin();
  if (origin) return origin;
  return import.meta.env.VITE_REALTIME_URL || window.location.origin;
}

export {};

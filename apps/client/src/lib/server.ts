/**
 * Où l'application trouve son serveur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Sur le web, la question ne se pose pas. Dans l'APK, elle décide de tout.     │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Servie par un navigateur, l'application partage le domaine de son API : une adresse relative
 * suffit, et rien n'est jamais demandé à personne. Installée en APK, il n'y a plus de « même
 * domaine » — l'application tourne sur `capacitor://localhost`, et une adresse relative la
 * renverrait vers elle-même. C'est exactement ce qui est arrivé au premier APK construit : il
 * s'installait, s'ouvrait, et restait vide.
 *
 * L'adresse se fixe donc normalement **à la construction**, par `VITE_API_URL`. C'est la bonne
 * façon de faire pour une application distribuée à des clients : personne ne devrait avoir à taper
 * une adresse de serveur pour commander un burger.
 *
 * Mais tant qu'aucun domaine n'existe, cette voie produit un APK mort. D'où ce repli : **si et
 * seulement si** l'application tourne en natif *et* qu'aucune adresse n'a été fixée à la
 * construction, elle la demande une fois et la retient. Cela rend l'APK utilisable dès aujourd'hui
 * — pointé sur un serveur de test, sur le réseau local par exemple — au lieu d'attendre
 * l'hébergement pour la première fois qu'on l'ouvre.
 *
 * Ce repli ne peut jamais apparaître à un vrai client : sur le web il n'est pas atteignable, et
 * dans un APK construit avec son adresse il ne se déclenche pas.
 */

const CLE = 'savora.serveur';

/** Adresse figée à la construction. Vide tant qu'aucun domaine n'est en service. */
const FIXEE = (import.meta.env.VITE_API_URL ?? '').trim();
const FIXEE_TEMPS_REEL = (import.meta.env.VITE_REALTIME_URL ?? '').trim();

/** Vrai dans l'application installée, faux dans un navigateur. */
export function estNatif(): boolean {
  return Boolean((window as { Capacitor?: unknown }).Capacitor);
}

function lireEnregistre(): string {
  try {
    return localStorage.getItem(CLE) ?? '';
  } catch {
    // Navigation privée, stockage refusé : on se comporte comme si rien n'était enregistré.
    return '';
  }
}

export function enregistrerServeur(saisie: string): boolean {
  const adresse = normaliser(saisie);
  if (!adresse) return false;
  try {
    localStorage.setItem(CLE, adresse);
  } catch {
    return false;
  }
  return true;
}

/**
 * Normalise ce que l'utilisateur a tapé.
 *
 * On écrit « monresto.bf », pas « https://monresto.bf ». Refuser la saisie sur un détail de
 * protocole serait un mauvais accueil pour la seule chose que l'application demande jamais.
 */
export function normaliser(saisie: string): string {
  const texte = (saisie ?? '').trim();
  if (!texte) return '';
  const complet = /^https?:\/\//i.test(texte) ? texte : `https://${texte}`;
  try {
    const url = new URL(complet);
    return url.hostname ? `${url.protocol}//${url.host}` : '';
  } catch {
    return '';
  }
}

/**
 * Construction destinée à un hébergeur de fichiers statiques.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une PWA s'héberge gratuitement en HTTPS. Une API, non.                       │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * GitHub Pages, Vercel, Netlify servent des fichiers — et servent très bien une PWA, avec une
 * adresse stable et un certificat. Ce qu'ils ne font pas, c'est faire tourner une API et une base de
 * données. Or une page servie en `https://` ne peut pas appeler une API en `http://` : le navigateur
 * refuse le contenu mixte.
 *
 * Une construction pour ce genre d'hébergeur doit donc **demander l'adresse de son API**, comme
 * l'APK le fait déjà. C'est la seule différence, et elle ne concerne que ce cas : servie par son
 * propre serveur, l'application garde son adresse relative et ne demande rien à personne.
 */
const HEBERGEMENT_STATIQUE = import.meta.env.VITE_ASK_SERVER === '1';

/**
 * Vrai lorsque l'application ne sait pas à quel serveur s'adresser et doit le demander.
 *
 * Deux situations, et deux seulement : l'application installée en APK, qui n'a pas d'origine à
 * partager, et une construction déposée chez un hébergeur de fichiers statiques. Servie par son
 * propre serveur — le cas normal — l'adresse relative fonctionne toujours et rien n'est demandé.
 */
export function serveurManquant(): boolean {
  if (FIXEE) return false;
  if (lireEnregistre()) return false;
  return estNatif() || HEBERGEMENT_STATIQUE;
}

/** Base des appels d'API. */
export function apiBase(): string {
  if (FIXEE) return FIXEE;
  const enregistre = lireEnregistre();
  if (enregistre) return `${enregistre}/api/v1`;
  return '/api/v1';
}

/** Origine du canal temps réel. */
export function realtimeOrigin(): string {
  if (FIXEE_TEMPS_REEL) return FIXEE_TEMPS_REEL;
  const enregistre = lireEnregistre();
  if (enregistre) return enregistre;
  return window.location.origin;
}

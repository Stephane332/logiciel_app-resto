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

/**
 * Oublie l'adresse enregistrée, pour que l'application la redemande.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une adresse fausse enregistrée une fois l'était pour toujours.               │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'écran de saisie ne s'affiche que si **aucune** adresse n'est retenue. Une adresse enregistrée
 * avant que la vérification n'existe — ou un serveur qui a changé d'adresse depuis — laissait donc
 * l'application charger dans le vide, indéfiniment, sans jamais reproposer la question. Un écran
 * blanc dont on ne sort pas, et qu'aucun rechargement ne répare.
 */
export function oublierServeur(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Stockage refusé : il n'y avait rien à oublier.
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
 *
 * ── Le protocole ne se devine pas au hasard ──
 *
 * Tout ce qui n'était pas préfixé partait en `https://`. Une adresse de réseau local —
 * « 192.168.1.12:4000 », l'exemple affiché juste sous le champ — devenait donc
 * « https://192.168.1.12:4000 », vers un serveur qui n'a aucun certificat et n'écoute pas en TLS.
 * Tous les appels échouaient, et l'application s'affichait vide. C'est le défaut qu'a rencontré la
 * première personne qui a essayé.
 *
 * Une adresse IP, ou un nom sans point — « caisse », « serveur-cuisine » — désigne une machine du
 * réseau local : elle part en `http://`. Un vrai nom de domaine part en `https://`. C'est la même
 * règle que celle du logiciel Windows, et elle doit l'être : deux règles divergentes sur le même
 * geste finiraient par se contredire.
 */
function protocolePour(hote: string): 'http:' | 'https:' {
  const sansPort = hote.split(':')[0] ?? '';
  const estIPv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(sansPort);
  const sansPoint = !sansPort.includes('.');
  return estIPv4 || sansPoint ? 'http:' : 'https:';
}

export function normaliser(saisie: string): string {
  const texte = (saisie ?? '').trim();
  if (!texte) return '';
  const complet = /^https?:\/\//i.test(texte) ? texte : `${protocolePour(texte)}//${texte}`;
  try {
    const url = new URL(complet);
    return url.hostname ? `${url.protocol}//${url.host}` : '';
  } catch {
    return '';
  }
}

/** Ce qu'on peut dire d'une adresse avant de l'enregistrer. */
export type Diagnostic =
  | { ok: true; adresse: string }
  | { ok: false; raison: 'invalide' | 'contenu-mixte' | 'injoignable'; message: string };

/**
 * Essaie l'adresse avant de l'enregistrer.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une adresse fausse acceptée en silence donne une application vide.           │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'adresse était retenue sans être essayée : l'application se rechargeait, chaque appel échouait,
 * et l'écran restait blanc — sans message, et sans moyen de revenir en arrière puisque l'écran de
 * saisie ne réapparaissait plus. Le pire enchaînement possible pour la seule question que
 * l'application pose.
 *
 * Deux refus, et le premier ne se découvre pas tout seul : **une page servie en `https://` ne peut
 * pas appeler une adresse en clair.** Le navigateur bloque, sans message visible et sans réglage.
 * C'est le cas de l'application déposée chez un hébergeur gratuit à qui l'on donnerait l'adresse
 * locale du restaurant : il faut le dire, parce que rien d'autre ne le dira.
 */
export async function essayerServeur(saisie: string, delaiMs = 6000): Promise<Diagnostic> {
  const adresse = normaliser(saisie);
  if (!adresse) {
    return { ok: false, raison: 'invalide', message: 'Adresse invalide. Exemple : 192.168.1.12:4000' };
  }

  /*
   * Le refus du contenu mixte ne vaut que dans un navigateur.
   *
   * L'application installée affiche elle aussi ses pages sous une origine `https` — c'est ce qui
   * permet aux liens profonds d'un QR de table de l'ouvrir. Mais elle, contrairement à une page
   * web, a le droit d'appeler une adresse en clair : l'empaquetage l'y autorise explicitement,
   * parce que le serveur d'un restaurant est un PC de réseau local sans certificat.
   *
   * Sans cette distinction, l'application installée refuserait la seule adresse qu'on puisse lui
   * donner aujourd'hui — et le refus viendrait de ce contrôle-ci, pas du système.
   */
  const pageSecurisee =
    !estNatif() && typeof window !== 'undefined' && window.location.protocol === 'https:';
  if (pageSecurisee && adresse.startsWith('http://')) {
    return {
      ok: false,
      raison: 'contenu-mixte',
      message:
        "Cette page est servie en « https », et un navigateur lui interdit d'appeler une adresse " +
        'en clair. Une adresse de réseau local ne peut donc pas marcher ici : il faut ouvrir ' +
        "l'application depuis le réseau du restaurant, ou donner une adresse « https » du serveur.",
    };
  }

  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), delaiMs);
  try {
    const reponse = await fetch(`${adresse}/api/v1/menu`, { signal: arret.signal });
    if (!reponse.ok) throw new Error(String(reponse.status));
    return { ok: true, adresse };
  } catch {
    return {
      ok: false,
      raison: 'injoignable',
      message:
        "Aucun serveur Savora ne répond à cette adresse. Vérifiez qu'elle est exacte, que " +
        "l'ordinateur de la caisse est allumé, et que ce téléphone est sur le même réseau que lui.",
    };
  } finally {
    clearTimeout(minuteur);
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

/**
 * Le serveur enregistré répond-il encore ?
 *
 * Renvoie `null` quand la question ne se pose pas — application servie par son propre serveur, ou
 * adresse figée à la construction. Sinon, `true` ou `false` après un essai réel.
 *
 * C'est ce qui permet de reproposer la question au lieu d'afficher le vide : une adresse saisie
 * avant que la vérification n'existe, un PC de caisse qui a changé d'adresse sur le réseau, un
 * serveur éteint — trois cas ordinaires qui laissaient l'application morte sans recours.
 */
export async function serveurEnregistreRepond(delaiMs = 6000): Promise<boolean | null> {
  if (FIXEE) return null;
  const enregistre = lireEnregistre();
  if (!enregistre) return null;

  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), delaiMs);
  try {
    const reponse = await fetch(`${enregistre}/api/v1/menu`, { signal: arret.signal });
    return reponse.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(minuteur);
  }
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

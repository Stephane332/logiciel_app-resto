/**
 * L'APK peut-elle seulement joindre le serveur d'un restaurant ?
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Rien, dans toute la chaîne, ne vérifiait l'APK elle-même.                    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Elle se construisait, s'installait, s'ouvrait — et ne pouvait strictement rien faire. Deux
 * verrous fermés, invisibles tant qu'on ne regarde pas l'empaquetage :
 *
 *   1. le WebView affiche ses pages sous une origine « https » et refusait le contenu mixte, donc
 *      tout appel vers une adresse en clair ;
 *   2. Android bloque le trafic en clair depuis la version 9, quelle que soit l'application.
 *
 * Or le serveur d'un restaurant est un PC de réseau local, sans certificat. L'APK ne pouvait donc
 * joindre que des serveurs HTTPS — et il n'en existe aucun tant qu'un restaurant n'a pas de
 * domaine. Le défaut ne se voyait qu'une fois l'application installée sur un vrai téléphone, sans
 * message, sans journal, sans rien.
 *
 * Ce contrôle lit la configuration d'empaquetage plutôt que d'espérer. Il coûte une seconde.
 *
 *   node scripts/verifier-apk.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ok = [];
const ko = [];
const v = (libelle, passe, detail = '') => {
  (passe ? ok : ko).push(libelle);
  console.log(`  ${passe ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` — ${detail}` : ''}`);
};

const CONFIG = resolve('apps/client/capacitor.config.ts');
const MANIFESTE = resolve('apps/client/android/app/src/main/AndroidManifest.xml');

console.log("── L'application peut joindre un serveur de réseau local ──");

/**
 * Les commentaires sont retirés avant toute lecture.
 *
 * Sans cela, un contrôle se contredisait lui-même : il annonçait « OK » et affichait « false » sur
 * la même ligne, parce qu'il avait lu la phrase du commentaire qui explique pourquoi le réglage a
 * changé, et non le réglage. Un contrôle dont le détail dément le verdict n'apprend plus rien à
 * personne — et fait douter de ceux qui sont justes.
 */
const sansCommentaires = (texte) =>
  texte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const config = sansCommentaires(readFileSync(CONFIG, 'utf8'));
const manifeste = existsSync(MANIFESTE) ? sansCommentaires(readFileSync(MANIFESTE, 'utf8')) : '';

// 1. Le WebView doit accepter d'appeler une adresse en clair depuis sa page « https ».
v(
  'Le contenu mixte est autorisé (sinon aucun serveur local joignable)',
  /allowMixedContent:\s*true/.test(config),
  /allowMixedContent:\s*(\w+)/.exec(config)?.[1] ?? 'non précisé',
);

// 2. Android doit laisser passer le trafic en clair.
v(
  'Android laisse passer le trafic en clair',
  /android:usesCleartextTraffic="true"/.test(manifeste),
  manifeste ? (/usesCleartextTraffic="(\w+)"/.exec(manifeste)?.[1] ?? 'absent') : 'manifeste introuvable',
);

// 3. L'origine des pages, qui décide des liens profonds du QR de table.
const schema = /androidScheme:\s*'(\w+)'/.exec(config)?.[1];
v("Les liens profonds d'un QR de table restent possibles", schema === 'https', `schéma ${schema}`);

console.log('\n── Ce que le code client en déduit ──');

const serveur = sansCommentaires(readFileSync(resolve('apps/client/src/lib/server.ts'), 'utf8'));
// Le refus du contenu mixte ne doit pas s'appliquer dans l'application installée : elle, elle a le
// droit. Sans cette distinction, l'application refuserait la seule adresse qu'on puisse lui donner.
v(
  "Le refus du contenu mixte ne s'applique qu'au navigateur",
  /!estNatif\(\)\s*&&[\s\S]{0,120}protocol === 'https:'/.test(serveur),
  'le natif garde le droit d\'appeler une adresse en clair',
);

console.log(`\n═════ ${ok.length} passées, ${ko.length} en échec ═════`);
ko.forEach((k) => console.log('  ✗', k));
process.exit(ko.length ? 1 : 0);

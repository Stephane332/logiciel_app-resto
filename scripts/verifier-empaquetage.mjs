/**
 * Tout ce que le logiciel demande à l'exécution est-il dans l'installateur ?
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un fichier oublié dans la liste d'empaquetage ne casse rien avant le client.│
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * La liste des fichiers embarqués était écrite à la main, module par module. Ajouter
 * `sauvegarde.cjs` au logiciel sans l'y inscrire a produit un installateur dont le `main.cjs`
 * réclamait un fichier absent : le logiciel ne démarrait pas du tout, chez le client, après un
 * téléchargement de 229 Mo. Tout était vert ici — en développement les fichiers sont là, puisqu'on
 * lit le dossier source.
 *
 * Ce contrôle lit chaque `require('./…')` des sources du logiciel et vérifie qu'un motif de la
 * liste le couvre. Il coûte une seconde et supprime une classe entière d'échec : celle qu'on ne
 * découvre qu'une fois le fichier installé sur une autre machine.
 *
 *   node scripts/verifier-empaquetage.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const BUREAU = resolve('apps/desktop');
const ok = [];
const ko = [];
const v = (libelle, passe, detail = '') => {
  (passe ? ok : ko).push(libelle);
  console.log(`  ${passe ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` — ${detail}` : ''}`);
};

const config = JSON.parse(readFileSync(join(BUREAU, 'package.json'), 'utf8'));
const motifs = config.build?.files ?? [];
console.log(`Liste d'empaquetage : ${motifs.join(', ')}\n`);

/** Un motif de la liste couvre-t-il ce fichier ? Seules les formes réellement employées ici. */
function couvert(fichier) {
  return motifs.some((motif) => {
    if (motif === fichier) return true;
    if (motif.endsWith('/**')) return fichier.startsWith(motif.slice(0, -2));
    if (motif.startsWith('*.')) return fichier.endsWith(motif.slice(1)) && !fichier.includes('/');
    return false;
  });
}

// --- Les modules que le logiciel charge à l'exécution ---
const sources = readdirSync(BUREAU).filter((nom) => nom.endsWith('.cjs'));
const demandes = new Set();
for (const source of sources) {
  const texte = readFileSync(join(BUREAU, source), 'utf8');
  for (const trouve of texte.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)) {
    const nom = trouve[1].endsWith('.cjs') ? trouve[1] : `${trouve[1]}.cjs`;
    demandes.add(nom);
  }
}

console.log(`── Modules chargés à l'exécution (${demandes.size}) ──`);
for (const nom of [...demandes].sort()) {
  const existe = existsSync(join(BUREAU, nom));
  v(`${nom} existe et sera empaqueté`, existe && couvert(nom),
    !existe ? 'fichier absent du dépôt' : couvert(nom) ? '' : "absent de la liste d'empaquetage");
}

// --- Le point d'entrée et les pages ---
console.log('\n── Point d\'entrée et pages ──');
v(`Le point d'entrée « ${config.main} » est empaqueté`, couvert(config.main));
for (const page of readdirSync(BUREAU).filter((n) => n.endsWith('.html'))) {
  v(`${page} est empaqueté`, couvert(page));
}

console.log(`\n═════ ${ok.length} passées, ${ko.length} en échec ═════`);
ko.forEach((k) => console.log('  ✗', k));
process.exit(ko.length ? 1 : 0);

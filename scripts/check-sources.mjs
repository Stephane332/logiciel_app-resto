/**
 * Refuse toute sortie de compilation tombée à côté des sources.
 *
 * Cette vérification existe à cause d'une panne réelle, et coûteuse à diagnostiquer. Un
 * `tsc` lancé à la main avait émis 142 fichiers `.js` et `.d.ts` au milieu de `src/`. Vite
 * résolvant « ./Checkout » en `.js` **avant** `.tsx`, le navigateur exécutait depuis lors du
 * code mort : le correctif suivant était bien dans le fichier source, bien servi par le
 * serveur de développement, et pourtant sans effet à l'écran. Rien ne le signalait — ni une
 * erreur, ni un avertissement, ni un test.
 *
 * Un garde-fou dans .gitignore empêche de les committer ; celui-ci les fait voir tout de
 * suite, y compris quand ils ne sont que sur la machine du développeur.
 *
 * **La première version ne regardait que `src/`, et c'était insuffisant.** Un `vite.config.js`
 * compilé traînait à la racine de l'application cliente : Vite préférant le `.js` au `.ts`, toute
 * la configuration lue était périmée — le manifeste de la PWA sortait avec les couleurs de
 * l'ancienne direction visuelle, et une reconstruction propre n'y changeait rien. On cherchait
 * l'erreur dans le fichier source, qui était juste. Les fichiers de configuration à la racine des
 * espaces de travail sont donc surveillés eux aussi.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps', 'packages'];
const SUSPECT = /\.(js|jsx|d\.ts|js\.map|d\.ts\.map)$/;
const strays = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.vite') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (SUSPECT.test(entry)) strays.push(full);
  }
}

/** Fichiers de configuration compilés, à la racine d'un espace de travail. */
const CONFIG_SUSPECT = /\.(config|conf)\.(js|cjs|mjs|d\.ts)$|\.config\.(js|d\.ts)\.map$/;

for (const root of ROOTS) {
  for (const workspace of readdirSync(root)) {
    const src = join(root, workspace, 'src');
    try {
      if (statSync(src).isDirectory()) walk(src);
    } catch {
      /* espace de travail sans src/ : rien à vérifier */
    }

    // La racine elle-même : un vite.config.js compilé y masque le vite.config.ts.
    try {
      for (const entry of readdirSync(join(root, workspace))) {
        if (CONFIG_SUSPECT.test(entry)) strays.push(join(root, workspace, entry));
      }
    } catch {
      /* espace de travail illisible : rien à vérifier */
    }
  }
}

if (strays.length > 0) {
  console.error(
    `\n${strays.length} fichier(s) compilé(s) traînent dans src/ et masquent les sources :\n`,
  );
  for (const stray of strays) console.error(`  ${stray}`);
  console.error(
    '\nVite les charge à la place des .ts/.tsx : votre code tourne sur une version périmée.',
  );
  console.error('Supprimez-les :\n');
  console.error(
    "  find apps packages -regextype posix-extended -regex '^(apps/[^/]+|packages/[^/]+)/src/.*\\.(js|jsx|d\\.ts|js\\.map|d\\.ts\\.map)$' -type f -not -path '*/node_modules/*' -delete\n",
  );
  process.exit(1);
}

console.log('Sources propres : aucun fichier compilé dans src/.');

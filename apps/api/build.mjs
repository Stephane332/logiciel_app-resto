/**
 * Construction de l'API pour la production.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  `tsc` compilait bien, et le résultat ne démarrait pas.                       │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * `npm run build` produisait un `dist/` impeccable, et `node dist/server.js` s'arrêtait aussitôt :
 *
 *     Cannot find module '…/packages/shared/src/enums.js'
 *     imported from …/packages/shared/src/index.ts
 *
 * La raison est dans les paquets internes. `@savora/shared` et `@savora/api-client` exposent leur
 * **source TypeScript** — c'est ce qui permet aux deux interfaces et aux tests de les utiliser sans
 * étape de construction, et c'est un bon choix pour eux. Mais Node, lui, ne sait pas lire du
 * TypeScript : l'API compilée importait un `.ts`, et mourait à la première ligne.
 *
 * Ce défaut n'était visible nulle part. Les 214 tests passent par vitest, qui lit la source. Le
 * développement passe par tsx, qui lit la source. Seule la **production** lisait le résultat compilé,
 * et elle n'avait jamais été lancée — ni dans l'image Docker du VPS, qui exécute exactement ce
 * fichier, ni dans le logiciel Windows qui embarque son propre serveur.
 *
 * La correction ne touche donc ni les paquets internes ni le développement : elle **assemble** l'API.
 * esbuild recopie le code des paquets `@savora/*` à l'intérieur du fichier produit, et laisse tout le
 * reste dehors — les dépendances npm restent dans `node_modules`, comme il se doit pour des modules
 * natifs comme `argon2`, `sharp` ou le moteur de requêtes de Prisma, qu'on ne peut pas assembler.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const manifeste = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * Tout reste extérieur, **sauf** les paquets internes.
 *
 * Les dépendances npm vivent dans `node_modules` à l'exécution : les assembler casserait les modules
 * natifs, et gonflerait le fichier pour rien. Les paquets `@savora/*`, eux, doivent entrer dedans —
 * c'est précisément ce qui manquait.
 */
const exterieur = [
  ...Object.keys(manifeste.dependencies ?? {}),
  ...Object.keys(manifeste.devDependencies ?? {}),
].filter((nom) => !nom.startsWith('@savora/'));

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: false,
  // Node 20 n'a pas `require` dans un module ESM, et certaines dépendances l'appellent encore.
  banner: {
    js: [
      "import { createRequire as __creerRequire } from 'node:module';",
      'const require = __creerRequire(import.meta.url);',
    ].join('\n'),
  },
  external: exterieur,
  logLevel: 'info',
});

// Les scripts d'exploitation — amorçage, simulateur de cuisine — se compilent de la même façon :
// ils importent eux aussi les paquets internes, et servent en production.
await build({
  entryPoints: ['prisma/seed.ts', 'prisma/premier-demarrage.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: [
      "import { createRequire as __creerRequire } from 'node:module';",
      'const require = __creerRequire(import.meta.url);',
    ].join('\n'),
  },
  external: exterieur,
  logLevel: 'info',
});

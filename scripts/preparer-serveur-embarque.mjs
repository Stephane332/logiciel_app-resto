/**
 * Prépare le serveur que l'installateur Windows emportera avec lui.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un restaurateur double-clique. Tout le reste doit être déjà dans le fichier. │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le logiciel installé sur le PC de la caisse porte son propre serveur : la base de données, l'API,
 * et le Node qui la fait tourner. Aucun de ces trois n'est installé sur le PC du restaurant — ils
 * sont **dans** l'installateur. Ce script les rassemble.
 *
 * ── Pourquoi un Node à part, alors qu'Electron en contient un ──
 *
 * Electron sait exécuter du Node (`ELECTRON_RUN_AS_NODE`), et c'est ce qu'on fait en développement.
 * Mais les modules natifs — `argon2`, `sharp` — doivent être compilés pour l'ABI exact du moteur qui
 * les charge, et celui d'Electron n'est pas celui de Node. Les faire correspondre demande de
 * recompiler à chaque montée de version d'Electron, et l'échec ne se voit qu'à l'exécution, chez le
 * client.
 *
 * On embarque donc le vrai `node.exe`. L'API devient une application Node ordinaire, dont les
 * dépendances s'installent normalement sur le runner Windows. Cinquante mégaoctets pour supprimer
 * une classe entière de pannes chez le client : c'est bon marché.
 *
 * ── Ce qui est assemblé ──
 *
 *   apps/desktop/api/        L'API compilée, son schéma, ses migrations, ses dépendances
 *   apps/desktop/postgres/   Les binaires PostgreSQL de la plate-forme visée
 *   apps/desktop/node/       Le Node qui exécute l'API
 *
 * Ces trois dossiers sont ignorés par git : ils se reconstruisent, ils ne se versionnent pas.
 *
 *   node scripts/preparer-serveur-embarque.mjs [--plateforme win32|linux] [--sans-postgres]
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const arguments_ = process.argv.slice(2);
const option = (nom, defaut) => {
  const index = arguments_.indexOf(`--${nom}`);
  return index === -1 ? defaut : arguments_[index + 1];
};
const drapeau = (nom) => arguments_.includes(`--${nom}`);

const plateforme = option('plateforme', process.platform);
const BUREAU = resolve('apps/desktop');
const API_SOURCE = resolve('apps/api');

/** Version de PostgreSQL embarquée. Elle doit correspondre au schéma et aux migrations. */
const PG_VERSION = '16.4';

/** Taille d'un fichier ou d'un dossier, pour dire ce que l'élagage rapporte. */
function tailleDe(chemin) {
  try {
    const infos = statSync(chemin);
    if (!infos.isDirectory()) return infos.size;
    return readdirSync(chemin).reduce((somme, entree) => somme + tailleDe(join(chemin, entree)), 0);
  } catch {
    return 0;
  }
}

function etape(texte) {
  console.log(`\n── ${texte}`);
}

/**
 * Le nom réel d'un outil selon la plate-forme.
 *
 * Sous Windows, `npm` et `npx` sont des scripts `.cmd` : `spawnSync('npm', …)` ne les trouve pas et
 * renvoie un code `null` — un échec muet qui ne dit pas qu'il s'agit d'un nom de fichier. C'est
 * exactement ainsi que la première construction Windows a échoué, et le message d'origine ne
 * permettait pas de le voir.
 *
 * On nomme donc l'exécutable réel plutôt que de passer par un interpréteur de commandes : `shell:
 * true` règlerait aussi le problème, mais en réintroduisant les ennuis de guillemets sur les chemins
 * qui contiennent des espaces — et « C:\Program Files » en contient.
 */
function outil(nom) {
  if (process.platform !== 'win32') return nom;
  return ['npm', 'npx'].includes(nom) ? `${nom}.cmd` : nom;
}

function executer(commande, args, options = {}) {
  const reel = outil(commande);
  const resultat = spawnSync(reel, args, { stdio: 'inherit', ...options });

  // `error` est renseigné quand le processus n'a pas pu être lancé du tout — nom introuvable, droits
  // manquants. Sans lui, le message se réduit à « code null », qui n'apprend rien.
  if (resultat.error) {
    throw new Error(`${reel} n'a pas pu être lancé : ${resultat.error.message}`);
  }
  if (resultat.status !== 0) {
    throw new Error(
      `${reel} ${args.join(' ')} a échoué (code ${resultat.status}${resultat.signal ? `, signal ${resultat.signal}` : ''}).`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. L'API
// ═══════════════════════════════════════════════════════════════════════════════

etape("Assemblage de l'API");

const API_CIBLE = join(BUREAU, 'api');
rmSync(API_CIBLE, { recursive: true, force: true });
mkdirSync(API_CIBLE, { recursive: true });

if (!existsSync(join(API_SOURCE, 'dist', 'server.js'))) {
  throw new Error("L'API n'est pas construite. Lancez : npm run build --workspace @savora/api");
}

cpSync(join(API_SOURCE, 'dist'), join(API_CIBLE, 'dist'), { recursive: true });

// Le schéma et les migrations : `prisma migrate deploy` en a besoin au premier démarrage chez le
// restaurant, et à chaque mise à jour du logiciel.
cpSync(join(API_SOURCE, 'prisma', 'schema.prisma'), join(API_CIBLE, 'prisma', 'schema.prisma'), {
  recursive: true,
});
cpSync(join(API_SOURCE, 'prisma', 'migrations'), join(API_CIBLE, 'prisma', 'migrations'), {
  recursive: true,
});

/*
 * Un manifeste réduit au strict nécessaire.
 *
 * `@savora/shared` n'y figure pas : esbuild l'a recopié dans le fichier compilé. Le garder ici
 * obligerait à embarquer tout l'espace de travail pour une dépendance déjà résolue.
 */
const manifesteSource = JSON.parse(readFileSync(join(API_SOURCE, 'package.json'), 'utf8'));
const dependances = Object.fromEntries(
  Object.entries(manifesteSource.dependencies).filter(([nom]) => !nom.startsWith('@savora/')),
);

writeFileSync(
  join(API_CIBLE, 'package.json'),
  `${JSON.stringify(
    {
      name: 'savora-serveur-embarque',
      private: true,
      version: manifesteSource.version,
      type: 'module',
      dependencies: { ...dependances, prisma: manifesteSource.devDependencies.prisma },
    },
    null,
    2,
  )}\n`,
);

etape('Installation des dépendances du serveur (production uniquement)');
executer('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: API_CIBLE });

// Le client Prisma et son moteur de requêtes, pour la plate-forme du runner.
etape('Génération du client Prisma');
executer('npx', ['prisma', 'generate', '--schema', join(API_CIBLE, 'prisma', 'schema.prisma')], {
  cwd: API_CIBLE,
});

/*
 * Élagage.
 *
 * Le poids compte : le logiciel voyage sur une clé USB ou par WhatsApp, sur des connexions qui ne
 * pardonnent pas. On ne retire que ce dont on peut démontrer l'inutilité — un installateur allégé qui
 * échoue chez le client coûte infiniment plus cher que cinquante mégaoctets.
 *
 * Un seul élagage a survécu à la vérification, et c'est instructif.
 *
 * Le moteur de requêtes de Prisma est installé **en trois exemplaires** de dix-sept mégaoctets, et un
 * seul est chargé à l'exécution. Retirer les deux autres semblait gratuit : trente-six mégaoctets
 * pour rien. Le contrôle a montré le contraire — l'outil en ligne de commande **vérifie leur présence
 * et tente de les retélécharger** :
 *
 *     Error: Can't write to node_modules/@prisma/engines
 *     please make sure you install "prisma" with the right permissions.
 *
 * Sur le PC d'un restaurant sans Internet, la migration échouerait donc au premier démarrage, et le
 * logiciel ne s'ouvrirait pas. Trente-six mégaoctets contre une caisse qui ne démarre pas : le
 * marché est vite jugé. Les trois exemplaires restent.
 */
etape('Élagage');

const aElaguer = [
  // Repli WebAssembly de sharp : sans objet dès que la version native est présente, et elle l'est.
  // Vérifié après retrait — la route de téléversement des photos répond toujours.
  join(API_CIBLE, 'node_modules', '@img', 'sharp-wasm32'),
];

let gagne = 0;
for (const chemin of aElaguer) {
  if (!existsSync(chemin)) continue;
  const taille = tailleDe(chemin);
  rmSync(chemin, { recursive: true, force: true });
  gagne += taille;
  console.log(`   retiré : ${chemin.replace(API_CIBLE, 'api')} (${(taille / 1e6).toFixed(0)} Mo)`);
}
console.log(`   ${(gagne / 1e6).toFixed(0)} Mo économisés`);

// ═══════════════════════════════════════════════════════════════════════════════
//  2. Le Node qui exécutera l'API
// ═══════════════════════════════════════════════════════════════════════════════

etape('Node embarqué');

const NODE_CIBLE = join(BUREAU, 'node');
rmSync(NODE_CIBLE, { recursive: true, force: true });
mkdirSync(NODE_CIBLE, { recursive: true });

// Celui du runner : c'est la version avec laquelle les dépendances viennent d'être installées, donc
// celle dont l'ABI correspond aux modules natifs. Prendre une autre version serait chercher l'ennui.
const nodeBinaire = process.execPath;
const nomNode = plateforme === 'win32' ? 'node.exe' : 'node';
copyFileSync(nodeBinaire, join(NODE_CIBLE, nomNode));
console.log(`   ${nomNode} copié depuis ${nodeBinaire}`);

// ═══════════════════════════════════════════════════════════════════════════════
//  3. PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════

if (drapeau('sans-postgres')) {
  etape('PostgreSQL : ignoré (--sans-postgres)');
  console.log('   Le logiciel se rabattra sur les binaires de la machine, en développement.');
} else {
  etape(`PostgreSQL ${PG_VERSION} pour ${plateforme}`);

  const PG_CIBLE = join(BUREAU, 'postgres');
  rmSync(PG_CIBLE, { recursive: true, force: true });
  mkdirSync(PG_CIBLE, { recursive: true });

  /*
   * Les binaires portables publiés par EnterpriseDB. Ce sont les mêmes que ceux de l'installateur
   * officiel, sans l'installateur : on les dépose, on ne les installe pas. Rien n'est écrit dans le
   * registre de Windows, rien n'est ajouté aux services — le logiciel démarre et arrête sa base
   * lui-même, et une désinstallation ne laisse rien derrière elle.
   */
  const archives = {
    win32: `postgresql-${PG_VERSION}-1-windows-x64-binaries.zip`,
    linux: `postgresql-${PG_VERSION}-1-linux-x64-binaries.tar.gz`,
    darwin: `postgresql-${PG_VERSION}-1-osx-binaries.zip`,
  };

  const archive = archives[plateforme];
  if (!archive) throw new Error(`Plate-forme non prise en charge : ${plateforme}`);

  const url = `https://get.enterprisedb.com/postgresql/${archive}`;
  const fichier = join(PG_CIBLE, archive);

  console.log(`   Téléchargement : ${url}`);
  executer('curl', ['-fsSL', '-o', fichier, url]);

  console.log('   Extraction…');
  if (archive.endsWith('.zip')) {
    executer(plateforme === 'win32' ? 'powershell' : 'unzip', 
      plateforme === 'win32'
        ? ['-Command', `Expand-Archive -Path "${fichier}" -DestinationPath "${PG_CIBLE}" -Force`]
        : ['-q', fichier, '-d', PG_CIBLE]);
  } else {
    executer('tar', ['xzf', fichier, '-C', PG_CIBLE]);
  }
  rmSync(fichier, { force: true });

  /*
   * L'archive contient un dossier `pgsql/` avec bin, lib, share. On le remonte d'un niveau pour que
   * `postgres/bin` soit le chemin attendu par le logiciel — un seul endroit à connaître.
   */
  const extrait = join(PG_CIBLE, 'pgsql');
  if (existsSync(extrait)) {
    for (const dossier of ['bin', 'lib', 'share']) {
      const source = join(extrait, dossier);
      if (existsSync(source)) cpSync(source, join(PG_CIBLE, dossier), { recursive: true });
    }
    rmSync(extrait, { recursive: true, force: true });
  }

  /*
   * Le poids compte : un installateur de 400 Mo se télécharge mal sur une connexion de Ouahigouya.
   * On retire ce qui ne sert jamais à un logiciel qui ne fait que démarrer sa base — les outils de
   * développement, la documentation, les fichiers d'en-tête, les bibliothèques statiques.
   */
  for (const inutile of ['include', 'doc', 'pgAdmin 4', 'symbols', join('lib', 'pkgconfig')]) {
    rmSync(join(PG_CIBLE, inutile), { recursive: true, force: true });
  }

  const binaire = join(PG_CIBLE, 'bin', plateforme === 'win32' ? 'initdb.exe' : 'initdb');
  if (!existsSync(binaire)) {
    throw new Error(`Extraction incomplète : ${binaire} est absent.`);
  }
  console.log(`   ✓ ${binaire}`);
}

etape('Terminé');
console.log(`   apps/desktop/api/       — API compilée et ses dépendances`);
console.log(`   apps/desktop/node/      — Node embarqué`);
if (!drapeau('sans-postgres')) console.log(`   apps/desktop/postgres/  — PostgreSQL ${PG_VERSION}`);

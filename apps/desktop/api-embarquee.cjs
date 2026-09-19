/**
 * L'API, embarquée dans le logiciel.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  L'API écoute sur tout le réseau. La base, seulement sur la machine.          │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * C'est la différence qui fait tout le montage : les tablettes de cuisine, les téléphones de
 * l'équipe et les clients sur place s'adressent à **l'API** du PC de la caisse. Elle doit donc
 * écouter sur le réseau local. La base, elle, n'a aucune raison d'y être — l'exposer ouvrirait la
 * comptabilité du restaurant à qui devine un mot de passe sur le Wi-Fi.
 *
 * Le processus est lancé avec le Node d'Electron (`ELECTRON_RUN_AS_NODE`) : le logiciel n'a donc
 * besoin d'aucun Node installé sur le PC du restaurant. C'est ce qui permet de tenir la promesse
 * d'un seul double-clic.
 *
 * Le secret de signature des sessions est tiré au hasard au premier lancement et conservé. Un secret
 * figé dans le logiciel serait le même chez tous les restaurants : un jeton fabriqué chez l'un
 * ouvrirait la caisse de l'autre.
 */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Port de l'API.
 *
 * Fixe et connu, parce que c'est lui que le restaurateur saisit sur les tablettes de son équipe :
 * « 192.168.1.20:4000 ». Un port tiré au hasard serait invisible et changerait à chaque démarrage.
 *
 * `SAVORA_API_PORT` permet de le déplacer — utile si un autre logiciel du poste occupe déjà 4000, et
 * indispensable pour éprouver le logiciel à côté d'un serveur de développement.
 */
const PORT = Number(process.env.SAVORA_API_PORT ?? 4000);

function secretDeSession(racineDonnees) {
  const fichier = path.join(racineDonnees, 'session.key');
  try {
    const existant = fs.readFileSync(fichier, 'utf8').trim();
    if (existant.length >= 32) return existant;
  } catch {
    // Premier lancement : il n'y a rien à lire.
  }
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.mkdirSync(racineDonnees, { recursive: true });
  fs.writeFileSync(fichier, secret, { mode: 0o600 });
  return secret;
}

/** Racine du paquet de l'API : `dist/` compilé, et le schéma Prisma à côté. */
function trouverApi() {
  const candidats = [
    process.env.SAVORA_API_DIR,
    path.join(__dirname, 'api'),
    path.join(process.resourcesPath ?? '', 'api'),
    // Développement : l'API compilée dans son espace de travail.
    path.join(__dirname, '..', 'api'),
  ].filter(Boolean);

  for (const dossier of candidats) {
    if (fs.existsSync(path.join(dossier, 'dist', 'server.js'))) return dossier;
  }
  return null;
}

/**
 * Où est l'outil de migration Prisma.
 *
 * Dans le logiciel installé, il est fourni à côté de l'API. En développement, npm le hisse à la
 * racine de l'espace de travail — d'où les deux emplacements : chercher au seul endroit attendu
 * marchait dans le paquet et échouait sur le poste de développement, c'est-à-dire là où on essaie.
 */
function trouverPrisma(api) {
  const candidats = [
    path.join(api, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(api, '..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(process.resourcesPath ?? '', 'api', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  return candidats.find((chemin) => fs.existsSync(chemin)) ?? null;
}

/** Le Node à utiliser : celui d'Electron dans le logiciel installé, celui du système en développement. */
function commandeNode() {
  const estElectron = Boolean(process.versions.electron);
  return {
    commande: process.execPath,
    env: estElectron ? { ELECTRON_RUN_AS_NODE: '1' } : {},
  };
}

/** L'environnement commun à toutes les étapes : schéma, amorçage, serveur. */
function environnementDe({ api, racineDonnees, urlBase }) {
  const { env: envNode } = commandeNode();
  return {
    ...process.env,
    ...envNode,
    NODE_ENV: 'production',
    PORT: String(PORT),
    // Sur tout le réseau : c'est ce qui rend le PC de la caisse joignable par les tablettes.
    HOST: '0.0.0.0',
    DATABASE_URL: urlBase,
    JWT_SECRET: secretDeSession(racineDonnees),
    // Les photos des plats vivent avec les données, jamais dans le dossier d'installation : une mise
    // à jour du logiciel ne doit pas emporter le travail de photographie du restaurant.
    UPLOAD_DIR: path.join(racineDonnees, 'photos'),
  };
}

/**
 * Applique le schéma de la base.
 *
 * Séparé du démarrage, et c'est une leçon du banc d'essai : l'amorçage lancé avant cette étape
 * échouait sur « la table restaurants n'existe pas ». L'ordre est donc imposé par le code plutôt que
 * laissé à la mémoire — schéma, puis amorçage, puis serveur.
 */
async function appliquerSchema({ racineDonnees, urlBase, journal = () => {} }) {
  const api = trouverApi();
  if (!api) throw new Error("Le serveur interne est introuvable. Le logiciel est incomplet : réinstallez-le.");

  const prismaCli = trouverPrisma(api);
  if (!prismaCli) {
    throw new Error("L'outil de migration est introuvable. Le logiciel est incomplet : réinstallez-le.");
  }

  journal('Mise à jour du schéma de la base…');
  const { commande } = commandeNode();
  const migration = spawnSync(
    commande,
    [prismaCli, 'migrate', 'deploy', '--schema', path.join(api, 'prisma', 'schema.prisma')],
    { encoding: 'utf8', env: environnementDe({ api, racineDonnees, urlBase }), cwd: api },
  );

  if (migration.status !== 0) {
    throw new Error(`Mise à jour du schéma impossible : ${migration.stderr || migration.stdout}`);
  }
}

/**
 * Crée le restaurant et son compte administrateur, si la base est encore vide.
 *
 * Idempotent : sur une base déjà configurée, il ne touche à rien et renvoie `deja: true`. Le logiciel
 * peut donc l'appeler à chaque démarrage sans se demander si c'est la première fois.
 */
async function amorcer({ racineDonnees, urlBase, nomRestaurant, telephone, motDePasse, journal = () => {} }) {
  const api = trouverApi();
  if (!api) throw new Error('Le serveur interne est introuvable.');

  const { commande } = commandeNode();
  journal('Préparation du restaurant…');

  const resultat = spawnSync(commande, [path.join(api, 'dist', 'premier-demarrage.js')], {
    encoding: 'utf8',
    cwd: api,
    env: {
      ...environnementDe({ api, racineDonnees, urlBase }),
      SAVORA_RESTO_NOM: nomRestaurant ?? '',
      SAVORA_ADMIN_TEL: telephone ?? '',
      SAVORA_ADMIN_MDP: motDePasse ?? '',
    },
  });

  const sortie = `${resultat.stdout ?? ''}${resultat.stderr ?? ''}`;
  if (sortie.includes('DEJA_CONFIGURE')) return { deja: true };
  if (sortie.includes('CONFIGURE')) return { deja: false };

  const raison = sortie.split('ECHEC ').pop()?.split('\n')[0]?.trim();
  throw new Error(raison || 'Préparation du restaurant impossible.');
}

async function demarrer({ racineDonnees, urlBase, journal = () => {} }) {
  const api = trouverApi();
  if (!api) {
    throw new Error("Le serveur interne est introuvable. Le logiciel est incomplet : réinstallez-le.");
  }

  const { commande } = commandeNode();
  const environnement = environnementDe({ api, racineDonnees, urlBase });

  journal(`Démarrage du serveur sur le port ${PORT}…`);
  const processus = spawn(commande, [path.join(api, 'dist', 'server.js')], {
    env: environnement,
    cwd: api,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  processus.stdout.on('data', (d) => journal(String(d).trim().slice(0, 200)));
  processus.stderr.on('data', (d) => journal(String(d).trim().slice(0, 200)));

  /*
   * Le port déjà occupé est le cas qu'il faut nommer.
   *
   * Sans cela, l'attente expirait et le message disait « le serveur n'a pas démarré » — vrai, et
   * inutile. Sur un poste de caisse où un autre logiciel écoute déjà sur 4000, c'est une demi-heure
   * de recherche pour une phrase manquante.
   */
  let portOccupe = false;
  processus.stderr.on('data', (d) => {
    if (String(d).includes('EADDRINUSE')) portOccupe = true;
  });

  const pret = await attendreSante();
  if (!pret) {
    processus.kill();
    if (portOccupe) {
      throw new Error(
        `Le port ${PORT} est déjà utilisé sur cet ordinateur par un autre logiciel. Fermez-le, ou contactez votre installateur.`,
      );
    }
    throw new Error("Le serveur interne n'a pas démarré. Consultez les journaux du logiciel.");
  }

  return {
    port: PORT,
    origine: `http://127.0.0.1:${PORT}`,
    arreter: () =>
      new Promise((resoudre) => {
        processus.once('exit', () => resoudre());
        processus.kill();
        setTimeout(resoudre, 4000);
      }),
  };
}

async function attendreSante() {
  for (let essai = 0; essai < 60; essai += 1) {
    try {
      const reponse = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(1200) });
      if (reponse.ok) return true;
    } catch {
      // Pas encore prêt : c'est le cas normal des premières secondes.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

module.exports = { appliquerSchema, amorcer, demarrer, PORT };

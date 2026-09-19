/**
 * La base de données, embarquée dans le logiciel.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un restaurateur n'installe pas PostgreSQL. Il double-clique sur un exe.      │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le montage voulu est celui-ci : le PC de la caisse **est** le serveur. La base y vit, l'API y
 * tourne, et les tablettes de cuisine, les téléphones de l'équipe et les clients sur place s'y
 * connectent par l'adresse de ce PC. Aucun abonnement, aucun VPS, et le restaurant garde ses données
 * chez lui.
 *
 * Pour que ce montage existe, il fallait que la base démarre seule. PostgreSQL est fourni avec le
 * logiciel, sous forme de binaires portables ; ce module s'occupe du reste — création du répertoire de
 * données au premier lancement, démarrage, arrêt propre à la fermeture.
 *
 * ── Trois choix qui méritent d'être dits ──
 *
 * **La base n'écoute que sur 127.0.0.1.** Les tablettes ne parlent pas à la base, elles parlent à
 * l'API ; c'est l'API qui doit être joignable sur le réseau, pas la base. Exposer PostgreSQL au Wi-Fi
 * d'un restaurant ouvrirait la comptabilité à quiconque devine un mot de passe.
 *
 * **Le mot de passe est tiré au hasard à la création** et rangé à côté du répertoire de données.
 * Aucun mot de passe par défaut ne traîne donc dans le logiciel — et il n'y en a pas deux identiques
 * chez deux restaurants.
 *
 * **Le répertoire de données vit dans les données de l'application**, pas dans le dossier
 * d'installation : une mise à jour du logiciel ne doit jamais frôler les commandes de l'année.
 */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');

/** Nom du rôle et de la base. Fixés, pour que rien ne dépende du nom de l'utilisateur Windows. */
const ROLE = 'savora';
const BASE = 'savora';

/**
 * Où sont les binaires de PostgreSQL.
 *
 * Dans le logiciel installé, ils sont fournis avec lui. En développement, on se sert de ceux de la
 * machine : cela permet d'éprouver tout le mécanisme sans empaqueter 200 Mo à chaque essai.
 */
function trouverBinaires(racineFournie) {
  const candidats = [
    racineFournie,
    process.env.SAVORA_PG_BIN,
    path.join(__dirname, 'postgres', 'bin'),
    path.join(process.resourcesPath ?? '', 'postgres', 'bin'),
  ].filter(Boolean);

  for (const dossier of candidats) {
    const initdb = path.join(dossier, process.platform === 'win32' ? 'initdb.exe' : 'initdb');
    if (fs.existsSync(initdb)) return dossier;
  }

  // Repli développement : les binaires installés sur la machine.
  for (const motif of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/local/pgsql/bin']) {
    if (fs.existsSync(path.join(motif, 'initdb'))) return motif;
  }

  return null;
}

function portLibre() {
  return new Promise((resoudre, rejeter) => {
    const sonde = net.createServer();
    sonde.on('error', rejeter);
    sonde.listen(0, '127.0.0.1', () => {
      const { port } = sonde.address();
      sonde.close(() => resoudre(port));
    });
  });
}

function lireReglages(fichier) {
  try {
    return JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Prépare et démarre la base.
 *
 * `racineDonnees` est le dossier de données de l'application : tout ce qui doit survivre à une mise à
 * jour y est rangé.
 */
async function demarrer({ racineDonnees, binaires, journal = () => {} }) {
  const bin = trouverBinaires(binaires);
  if (!bin) {
    throw new Error(
      "PostgreSQL est introuvable. Le logiciel a été installé sans sa base de données : réinstallez-le.",
    );
  }

  const dossierBase = path.join(racineDonnees, 'base');
  const fichierReglages = path.join(racineDonnees, 'base.json');
  const exe = (nom) => path.join(bin, process.platform === 'win32' ? `${nom}.exe` : nom);

  let reglages = lireReglages(fichierReglages);

  // ── Première fois : créer le répertoire de données ──
  if (!reglages || !fs.existsSync(path.join(dossierBase, 'PG_VERSION'))) {
    journal('Création de la base de données…');
    fs.mkdirSync(racineDonnees, { recursive: true });
    fs.rmSync(dossierBase, { recursive: true, force: true });

    const motDePasse = crypto.randomBytes(24).toString('base64url');
    const fichierMotDePasse = path.join(racineDonnees, '.pg-init');
    fs.writeFileSync(fichierMotDePasse, motDePasse, { mode: 0o600 });

    const creation = spawnSync(
      exe('initdb'),
      [
        '-D', dossierBase,
        '-U', ROLE,
        `--pwfile=${fichierMotDePasse}`,
        '-A', 'scram-sha-256',
        // L'encodage n'est pas un détail : sans UTF-8, « Ouahigouya » et les accents des noms de
        // plats se corrompent en base, et on ne s'en aperçoit qu'à l'impression d'un ticket.
        '-E', 'UTF8',
        '--locale=C',
      ],
      { encoding: 'utf8' },
    );

    // Le fichier de mot de passe ne sert qu'à initdb : il ne doit pas rester sur le disque.
    fs.rmSync(fichierMotDePasse, { force: true });

    if (creation.status !== 0) {
      throw new Error(`Création de la base impossible : ${creation.stderr || creation.stdout}`);
    }

    reglages = { motDePasse, port: null };
    fs.writeFileSync(fichierReglages, JSON.stringify(reglages), { mode: 0o600 });
  }

  // ── Le port peut changer d'un démarrage à l'autre : un autre logiciel a pu prendre le précédent ──
  const port = await portLibre();
  reglages.port = port;
  fs.writeFileSync(fichierReglages, JSON.stringify(reglages), { mode: 0o600 });

  journal(`Démarrage de la base sur le port ${port}…`);
  const processus = spawn(
    exe('postgres'),
    [
      '-D', dossierBase,
      '-p', String(port),
      // Uniquement la boucle locale : les tablettes parlent à l'API, jamais à la base.
      '-c', 'listen_addresses=127.0.0.1',
      // Un PC de caisse n'est pas un serveur : on ne lui prend pas 128 Mo pour rien.
      '-c', 'shared_buffers=64MB',
      '-c', 'max_connections=50',
      // Les journaux de la base vont dans les données de l'application, pas dans la console.
      '-c', `log_directory=${path.join(racineDonnees, 'journaux')}`,
      '-c', 'logging_collector=on',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  processus.stdout.on('data', (d) => journal(String(d).trim()));
  processus.stderr.on('data', (d) => journal(String(d).trim()));

  // ── Attendre que la base accepte les connexions ──
  const pret = await attendrePret(exe('pg_isready'), port);
  if (!pret) {
    processus.kill();
    throw new Error("La base de données n'a pas démarré. Consultez les journaux du logiciel.");
  }

  // ── Créer la base applicative si elle n'existe pas ──
  const existe = spawnSync(
    exe('psql'),
    ['-h', '127.0.0.1', '-p', String(port), '-U', ROLE, '-d', 'postgres', '-tAc',
     `SELECT 1 FROM pg_database WHERE datname='${BASE}'`],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: reglages.motDePasse } },
  );

  if (existe.stdout.trim() !== '1') {
    journal('Création du schéma applicatif…');
    const creation = spawnSync(
      exe('createdb'),
      ['-h', '127.0.0.1', '-p', String(port), '-U', ROLE, '-O', ROLE, '-E', 'UTF8', BASE],
      { encoding: 'utf8', env: { ...process.env, PGPASSWORD: reglages.motDePasse } },
    );
    if (creation.status !== 0) {
      throw new Error(`Création du schéma impossible : ${creation.stderr}`);
    }
  }

  const url = `postgresql://${ROLE}:${encodeURIComponent(reglages.motDePasse)}@127.0.0.1:${port}/${BASE}?schema=public`;

  return {
    url,
    port,
    /** Arrêt propre : une base tuée brutalement rejoue son journal au démarrage suivant. */
    arreter: () =>
      new Promise((resoudre) => {
        spawnSync(exe('pg_ctl'), ['-D', dossierBase, '-m', 'fast', 'stop'], { encoding: 'utf8' });
        processus.once('exit', () => resoudre());
        processus.kill();
        setTimeout(resoudre, 5000);
      }),
  };
}

async function attendrePret(pgIsReady, port) {
  for (let essai = 0; essai < 40; essai += 1) {
    const test = spawnSync(pgIsReady, ['-h', '127.0.0.1', '-p', String(port), '-q'], { encoding: 'utf8' });
    if (test.status === 0) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

module.exports = { demarrer, trouverBinaires, ROLE, BASE };

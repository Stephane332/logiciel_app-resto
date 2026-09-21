/**
 * La sauvegarde des données du restaurant.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Le disque d'un PC de restaurant finit toujours par mourir.                   │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Tout vit sur cette machine : les commandes, le menu, les photos que le restaurant a mis des
 * heures à prendre, les comptes de l'équipe, les écritures de commission. Une panne de disque, un
 * vol, un formatage, et il ne reste rien — et rien, ici, veut dire qu'un restaurateur ne peut plus
 * ouvrir sa caisse un matin.
 *
 * Le guide de déploiement décrivait des sauvegardes pour le serveur loué. Le produit qu'on vend
 * n'est pas un serveur loué : c'est cet ordinateur-ci, sans administrateur, sans surveillance, et
 * personne n'y lancera jamais une commande à la main. La sauvegarde doit donc se faire seule.
 *
 * ── Ce que cette sauvegarde protège, et ce qu'elle ne protège pas ──
 *
 * Elle est écrite sur le **même disque**. Elle protège de ce qui arrive le plus souvent : une base
 * abîmée, une mauvaise manipulation, une mise à jour qui tourne mal, un dossier effacé. Elle ne
 * protège **pas** d'un disque mort ni d'un vol — pour cela il faut copier le dossier ailleurs, sur
 * une clé USB ou un disque externe. C'est écrit en toutes lettres à côté des fichiers, parce qu'une
 * sauvegarde dont on surestime la portée est pire qu'une absence de sauvegarde : elle rassure.
 *
 * Le dossier est donc placé dans les **Documents** du poste, là où quelqu'un pense à regarder et
 * sait copier — pas dans un répertoire d'application que personne n'ouvre jamais.
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

/** Nombre de sauvegardes conservées. Au-delà, la plus ancienne s'efface. */
const A_GARDER = 14;

const LISEZ_MOI = `Sauvegardes de Savora Pro
=========================

Ce dossier contient les données de votre restaurant : commandes, menu, comptes, photos.
Une sauvegarde est faite automatiquement à chaque démarrage du logiciel, au plus une par jour.
Les ${A_GARDER} dernières sont conservées ; les plus anciennes s'effacent toutes seules.

  ATTENTION — ces fichiers sont sur le MÊME disque que le logiciel.

Ils vous protègent d'une base abîmée ou d'une mauvaise manipulation.
Ils ne vous protègent PAS d'un disque en panne, d'un vol ou d'un incendie.

  → Copiez ce dossier sur une clé USB ou un disque externe, une fois par semaine.

Pour restaurer, appelez la personne qui vous a installé le logiciel : le fichier .dump se
recharge avec l'outil pg_restore fourni avec Savora Pro.
`;

/** Horodatage triable et lisible : 2026-09-21_2130. */
function horodatage(date = new Date()) {
  const d = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${d(date.getMonth() + 1)}-${d(date.getDate())}_${d(date.getHours())}${d(date.getMinutes())}`;
}

/** Le jour d'une sauvegarde, d'après son nom de fichier. */
function jourDe(nom) {
  const trouve = nom.match(/(\d{4}-\d{2}-\d{2})/);
  return trouve ? trouve[1] : null;
}

/**
 * Une sauvegarde a-t-elle déjà été faite aujourd'hui ?
 *
 * Le logiciel d'une caisse se relance plusieurs fois par jour — coupure de courant, redémarrage,
 * employé qui ferme la fenêtre. Sauvegarder à chaque fois remplirait le disque de copies identiques
 * et pousserait dehors les sauvegardes des jours précédents, qui sont les seules utiles.
 */
function dejaFaiteAujourdhui(dossier) {
  if (!fs.existsSync(dossier)) return false;
  const aujourdhui = horodatage().slice(0, 10);
  return fs.readdirSync(dossier).some((nom) => nom.endsWith('.dump') && jourDe(nom) === aujourdhui);
}

/** Efface les plus anciennes au-delà de la limite. */
function faireDeLaPlace(dossier) {
  const copies = fs
    .readdirSync(dossier)
    .filter((nom) => nom.endsWith('.dump'))
    .sort();
  for (const nom of copies.slice(0, Math.max(0, copies.length - A_GARDER))) {
    fs.rmSync(path.join(dossier, nom), { force: true });
    // Les photos du même horodatage partent avec : une base sans ses photos ne restaure qu'à moitié.
    fs.rmSync(path.join(dossier, nom.replace(/\.dump$/, '-photos')), { recursive: true, force: true });
  }
}

/**
 * Sauvegarde la base et les photos.
 *
 * `pg_dump --format=custom` plutôt qu'un fichier SQL : il se restaure table par table, il compresse,
 * et il ne dépend pas de la version exacte du serveur au moment de la relecture.
 *
 * Les photos sont **copiées**, pas archivées : sans outil d'archivage garanti sur un poste Windows,
 * une copie simple est ce qui a le plus de chances de fonctionner le jour où quelqu'un en a besoin.
 * Ce jour-là, il faut que ce soit évident, pas astucieux.
 */
function sauvegarder({ dossierSauvegardes, binaires, urlBase, dossierPhotos, forcer = false, journal = () => {} }) {
  fs.mkdirSync(dossierSauvegardes, { recursive: true });
  fs.writeFileSync(path.join(dossierSauvegardes, 'LISEZ-MOI.txt'), LISEZ_MOI, 'utf8');

  if (!forcer && dejaFaiteAujourdhui(dossierSauvegardes)) {
    return { fait: false, raison: 'deja-aujourdhui' };
  }

  const exe = (nom) => path.join(binaires, process.platform === 'win32' ? `${nom}.exe` : nom);
  const pgDump = exe('pg_dump');
  if (!fs.existsSync(pgDump)) return { fait: false, raison: 'pg_dump-introuvable' };

  const marque = horodatage();
  const fichier = path.join(dossierSauvegardes, `savora_${marque}.dump`);

  /*
   * L'adresse de la base, débarrassée de ce que Prisma y ajoute.
   *
   * Prisma écrit « …/savora?schema=public ». `schema` est une option **de Prisma** : la
   * bibliothèque de PostgreSQL ne la connaît pas et refuse l'adresse entière avec « invalid URI
   * query parameter ». La sauvegarde échouait donc en silence, et le dossier ne contenait que son
   * fichier d'explications — la pire forme d'échec, celle qui a l'air d'avoir marché.
   */
  const adresse = urlBase.split('?')[0];

  journal('Sauvegarde des données…');
  const copie = spawnSync(pgDump, ['--format=custom', '--file', fichier, adresse], { encoding: 'utf8' });
  if (copie.status !== 0) {
    // Un fichier partiel est pire qu'aucun fichier : il passerait pour une sauvegarde valable.
    fs.rmSync(fichier, { force: true });
    return { fait: false, raison: 'echec', detail: copie.stderr || copie.error?.message || '' };
  }

  if (dossierPhotos && fs.existsSync(dossierPhotos)) {
    const cible = path.join(dossierSauvegardes, `savora_${marque}-photos`);
    fs.rmSync(cible, { recursive: true, force: true });
    fs.cpSync(dossierPhotos, cible, { recursive: true });
  }

  faireDeLaPlace(dossierSauvegardes);
  const taille = fs.statSync(fichier).size;
  journal(`Sauvegarde faite (${Math.round(taille / 1024)} Ko).`);
  return { fait: true, fichier, taille };
}

module.exports = { sauvegarder, A_GARDER };

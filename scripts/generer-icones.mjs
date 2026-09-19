/**
 * Produit les icônes de l'application à partir de la marque.
 *
 * Un seul dessin fait autorité : `packages/ui/assets/mark.svg`. Les tailles en découlent, et il
 * suffit de relancer ce script quand la marque change. Des PNG dessinés à la main finissent
 * toujours par diverger — on corrige le logo, on oublie une taille, et l'ancienne identité survit
 * sur l'écran d'accueil d'un téléphone pendant des mois.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const marque = readFileSync(resolve('packages/ui/assets/mark.svg'));
const masquable = readFileSync(resolve('packages/ui/assets/mark-maskable.svg'));
const sortie = resolve('apps/client/public');
await mkdir(sortie, { recursive: true });

const tailles = [
  [marque, 192, 'icon-192.png'],
  [marque, 512, 'icon-512.png'],
  [marque, 180, 'apple-touch-icon.png'],
  [masquable, 512, 'icon-maskable-512.png'],
];

for (const [source, taille, nom] of tailles) {
  await sharp(source, { density: 384 }).resize(taille, taille).png().toFile(resolve(sortie, nom));
  console.log(`  ${nom} — ${taille}×${taille}`);
}

copyFileSync(resolve('packages/ui/assets/mark.svg'), resolve(sortie, 'favicon.svg'));
console.log('  favicon.svg');

/*
 * Icônes de lancement Android.
 *
 * Elles vivent dans le projet Capacitor, qui est versionné : sans ce passage, l'ancienne identité
 * survivrait sur l'écran d'accueil des téléphones déjà équipés, et personne ne penserait à la
 * chercher là. Le premier plan utilise la version masquable — Android rogne l'icône selon la forme
 * choisie par le constructeur, et un dessin calé sur les bords s'y ferait amputer.
 */
const android = resolve('apps/client/android/app/src/main/res');
const densites = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

console.log('\nAndroid :');
for (const [densite, taille] of densites) {
  const dossier = resolve(android, `mipmap-${densite}`);
  await mkdir(dossier, { recursive: true });
  await sharp(marque, { density: 384 }).resize(taille, taille).png().toFile(resolve(dossier, 'ic_launcher.png'));
  await sharp(marque, { density: 384 }).resize(taille, taille).png().toFile(resolve(dossier, 'ic_launcher_round.png'));
  // Le premier plan adaptatif se dessine sur une toile plus grande que l'icône finale.
  await sharp(masquable, { density: 384 })
    .resize(Math.round(taille * 2.25), Math.round(taille * 2.25))
    .png()
    .toFile(resolve(dossier, 'ic_launcher_foreground.png'));
  console.log(`  mipmap-${densite} — ${taille}×${taille}`);
}

/*
 * Le logiciel restaurant et l'enveloppe Windows.
 *
 * Ils avaient été oubliés lors du changement de marque, et l'oubli était invisible depuis un poste
 * de développement : l'ancien badge — le pain doré sur vert nuit — restait dans l'onglet du
 * navigateur du gérant, toute la journée, sous ses yeux. C'est précisément l'endroit où une marque
 * se juge.
 */
// L'enveloppe Windows n'a pas sa propre copie : `npm run build:desktop` y recopie la construction
// du logiciel restaurant, favicon comprise. Une copie de plus ici divergerait au premier oubli.
console.log('\nLogiciel restaurant et Windows :');
copyFileSync(resolve('packages/ui/assets/mark.svg'), resolve('apps/restaurant/public/favicon.svg'));
console.log('  apps/restaurant/public/favicon.svg');

/**
 * Icône de l'installateur et de la fenêtre Windows, au format ICO.
 *
 * `electron-builder` attend `build/icone.ico`. Le fichier n'existait pas : la construction ne
 * s'arrêtait pas pour si peu, elle retombait sur l'icône d'Electron. Le logiciel s'installait donc
 * sous le logo d'Electron — sur le bureau du gérant, dans le menu Démarrer et dans la barre des
 * tâches.
 *
 * Un ICO n'est qu'un conteneur : un en-tête, une entrée par taille, puis les images. Depuis Windows
 * Vista, ces images peuvent être des PNG — on les écrit donc directement, sans dépendance de plus
 * pour six en-têtes de seize octets.
 */
async function ecrireIco(source, destination, tailles) {
  const images = [];
  for (const taille of tailles) {
    images.push({
      taille,
      donnees: await sharp(source, { density: 384 }).resize(taille, taille).png().toBuffer(),
    });
  }

  const ENTETE = 6;
  const ENTREE = 16;
  const entete = Buffer.alloc(ENTETE);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // 1 = icône
  entete.writeUInt16LE(images.length, 4);

  let position = ENTETE + ENTREE * images.length;
  const entrees = [];
  for (const { taille, donnees } of images) {
    const entree = Buffer.alloc(ENTREE);
    // 256 s'écrit 0 : un octet ne va pas plus loin, et c'est la convention du format.
    entree.writeUInt8(taille >= 256 ? 0 : taille, 0);
    entree.writeUInt8(taille >= 256 ? 0 : taille, 1);
    entree.writeUInt8(0, 2); // palette : aucune
    entree.writeUInt8(0, 3); // réservé
    entree.writeUInt16LE(1, 4); // plans
    entree.writeUInt16LE(32, 6); // bits par pixel
    entree.writeUInt32LE(donnees.length, 8);
    entree.writeUInt32LE(position, 12);
    entrees.push(entree);
    position += donnees.length;
  }

  await writeFile(destination, Buffer.concat([entete, ...entrees, ...images.map((i) => i.donnees)]));
  return position;
}

const ico = resolve('apps/desktop/build');
await mkdir(ico, { recursive: true });
const octets = await ecrireIco(marque, resolve(ico, 'icone.ico'), [16, 32, 48, 64, 128, 256]);
console.log(`  apps/desktop/build/icone.ico — 6 tailles, ${(octets / 1024).toFixed(1)} Ko`);

console.log('\nIcônes régénérées depuis packages/ui/assets/mark.svg');

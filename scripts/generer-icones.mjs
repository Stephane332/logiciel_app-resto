/**
 * Produit les icônes de l'application à partir de la marque.
 *
 * Un seul dessin fait autorité : `packages/ui/assets/mark.svg`. Les tailles en découlent, et il
 * suffit de relancer ce script quand la marque change. Des PNG dessinés à la main finissent
 * toujours par diverger — on corrige le logo, on oublie une taille, et l'ancienne identité survit
 * sur l'écran d'accueil d'un téléphone pendant des mois.
 */
import { mkdir } from 'node:fs/promises';
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

console.log('\nIcônes régénérées depuis packages/ui/assets/mark.svg');

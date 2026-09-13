/**
 * Icônes et écrans de lancement Android.
 *
 * Générés depuis les SVG du design system, puis versionnés : l'intégration continue construit l'APK
 * sans avoir besoin d'un moteur de rendu d'images.
 *
 *   npm i -D sharp && node scripts/generate-android-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../../../packages/ui/assets');
const res = resolve(here, '../android/app/src/main/res');

const { default: sharp } = await import('sharp');

const BACKGROUND = '#07130F';

/** Densités Android : l'icône fait 48 dp, le premier plan adaptatif 108 dp. */
const DENSITIES = [
  { dir: 'mdpi', launcher: 48, foreground: 108, splash: 320 },
  { dir: 'hdpi', launcher: 72, foreground: 162, splash: 480 },
  { dir: 'xhdpi', launcher: 96, foreground: 216, splash: 720 },
  { dir: 'xxhdpi', launcher: 144, foreground: 324, splash: 960 },
  { dir: 'xxxhdpi', launcher: 192, foreground: 432, splash: 1280 },
];

for (const density of DENSITIES) {
  const dir = resolve(res, `mipmap-${density.dir}`);
  await mkdir(dir, { recursive: true });

  await sharp(resolve(assets, 'mark.svg'))
    .resize(density.launcher, density.launcher)
    .png()
    .toFile(resolve(dir, 'ic_launcher.png'));

  // L'icône ronde reçoit le même dessin : le badge est déjà circulaire dans sa zone utile.
  await sharp(resolve(assets, 'mark.svg'))
    .resize(density.launcher, density.launcher)
    .png()
    .toFile(resolve(dir, 'ic_launcher_round.png'));

  // Premier plan adaptatif : le motif doit tenir dans les 66 % centraux, sinon le système le rogne.
  const inner = Math.round(density.foreground * 0.62);
  const pad = Math.round((density.foreground - inner) / 2);
  await sharp(resolve(assets, 'mark-maskable.svg'))
    .resize(inner, inner)
    .extend({
      top: pad,
      bottom: density.foreground - inner - pad,
      left: pad,
      right: density.foreground - inner - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(resolve(dir, 'ic_launcher_foreground.png'));

  // Écran de lancement, portrait et paysage.
  for (const orientation of ['port', 'land']) {
    const dir = resolve(res, `drawable-${orientation}-${density.dir}`);
    await mkdir(dir, { recursive: true });
    const width = orientation === 'port' ? density.splash : Math.round(density.splash * 1.6);
    const height = orientation === 'port' ? Math.round(density.splash * 1.6) : density.splash;
    const markSize = Math.round(Math.min(width, height) * 0.34);

    const mark = await sharp(resolve(assets, 'mark.svg')).resize(markSize, markSize).png().toBuffer();
    await sharp({
      create: { width, height, channels: 4, background: BACKGROUND },
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toFile(resolve(dir, 'splash.png'));
  }
}

// Écran de lancement par défaut, utilisé quand aucune densité ne correspond.
await mkdir(resolve(res, 'drawable'), { recursive: true });
const defaultMark = await sharp(resolve(assets, 'mark.svg')).resize(320, 320).png().toBuffer();
await sharp({ create: { width: 960, height: 1536, channels: 4, background: BACKGROUND } })
  .composite([{ input: defaultMark, gravity: 'center' }])
  .png()
  .toFile(resolve(res, 'drawable/splash.png'));

// Fond de l'icône adaptative : la couleur de la marque, pas un blanc par défaut.
await writeFile(
  resolve(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BACKGROUND}</color>
</resources>
`,
  'utf8',
);

console.log('Icônes et écrans de lancement Android générés.');

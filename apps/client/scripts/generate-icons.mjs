/**
 * Génère les icônes PNG de la PWA à partir des SVG du design system.
 *
 * Exécuté à la demande, pas au build : les PNG sont versionnés pour que l'intégration continue et
 * l'APK n'aient pas besoin d'un moteur de rendu d'images.
 *
 *   npx --yes sharp-cli ...   ou   npm i -D sharp && npm run icons
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../../../packages/ui/assets');
const out = resolve(here, '../public');

const { default: sharp } = await import('sharp');

await mkdir(out, { recursive: true });

const jobs = [
  { src: 'mark.svg', size: 192, name: 'icon-192.png' },
  { src: 'mark.svg', size: 512, name: 'icon-512.png' },
  { src: 'mark.svg', size: 180, name: 'apple-touch-icon.png' },
  { src: 'mark-maskable.svg', size: 512, name: 'icon-maskable-512.png' },
];

for (const job of jobs) {
  await sharp(resolve(assets, job.src)).resize(job.size, job.size).png({ compressionLevel: 9 }).toFile(resolve(out, job.name));
  console.log(`${job.name} (${job.size}px)`);
}

console.log('Icônes générées.');

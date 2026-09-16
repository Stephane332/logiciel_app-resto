/**
 * Prépare l'application Windows : copie l'interface construite dans le paquet Electron.
 *
 * L'interface n'est pas dupliquée dans le dépôt, elle est copiée au moment de la construction. Deux
 * copies d'un même code finissent toujours par diverger, et la divergence se découvre en
 * production, sur le poste d'un restaurant, un vendredi soir.
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('apps/restaurant/dist');
const cible = resolve('apps/desktop/web');

if (!existsSync(source)) {
  console.error(
    "L'interface du restaurant n'est pas construite.\n" +
      'Lancez d\'abord : npm run build --workspace @savora/restaurant',
  );
  process.exit(1);
}

await rm(cible, { recursive: true, force: true });
await mkdir(cible, { recursive: true });
await cp(source, cible, { recursive: true });

console.log('Interface copiée dans apps/desktop/web — prête à être empaquetée.');

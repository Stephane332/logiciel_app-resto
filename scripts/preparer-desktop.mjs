/**
 * Prépare l'application Windows : copie l'interface construite dans le paquet Electron.
 *
 * L'interface n'est pas dupliquée dans le dépôt, elle est copiée au moment de la construction. Deux
 * copies d'un même code finissent toujours par diverger, et la divergence se découvre en
 * production, sur le poste d'un restaurant, un vendredi soir.
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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

/*
 * L'application des clients, elle aussi portée par le serveur du restaurant.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un client à iPhone, assis dans la salle, n'avait rien à ouvrir.              │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'APK couvre Android. Le lien public couvre ceux qui commandent de chez eux — mais il est servi
 * en `https` et ne peut donc pas appeler le PC du restaurant, qui est en clair. Restait un trou
 * exactement au milieu : le client présent dans le restaurant, sur son téléphone, et surtout sur
 * iPhone où aucun APK ne s'installe. Il n'avait aucune porte d'entrée.
 *
 * L'application cliente est donc empaquetée avec le logiciel et servie par le même serveur, sous
 * « /commander ». Même adresse que l'équipe, même origine, tout en clair sur le réseau du
 * restaurant : ni CORS, ni contenu mixte, et un QR de table qui mène droit au menu.
 *
 * Elle est construite pour ce sous-chemin — la même mécanique que pour la mise en ligne publique,
 * déjà éprouvée. Sans cela, ses scripts pointeraient à la racine, qui appartient au logiciel du
 * restaurant : le client recevrait l'écran de connexion du personnel.
 */
const CHEMIN_CLIENT = '/commander/';
const sourceClient = resolve('apps/client/dist');
const cibleClient = resolve('apps/desktop/web-client');

console.log(`\nApplication cliente, construite pour ${CHEMIN_CLIENT} …`);
const construction = spawnSync('npm', ['run', 'build', '--workspace', '@savora/client'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: CHEMIN_CLIENT },
});
if (construction.status !== 0) {
  console.error("La construction de l'application cliente a échoué.");
  process.exit(1);
}

await rm(cibleClient, { recursive: true, force: true });
await mkdir(cibleClient, { recursive: true });
await cp(sourceClient, cibleClient, { recursive: true });

console.log('Application cliente copiée dans apps/desktop/web-client.');

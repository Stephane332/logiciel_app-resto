/**
 * Vérifie la construction destinée à GitHub Pages — sous son sous-chemin, dans les deux moteurs.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  GitHub Pages ne sert pas à la racine du domaine. Tout en découle.           │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Une PWA déposée sur Pages vit sous « /nom-du-depot/ ». Cinq choses cassent silencieusement quand
 * on l'oublie, et aucune ne se voit sur la machine de développement :
 *
 *   1. les scripts de `index.html` pointent à la racine → page blanche ;
 *   2. le routeur ne reconnaît plus ses propres adresses → écran « introuvable » ;
 *   3. le service worker demande un périmètre hors de son chemin → refus du navigateur, donc
 *      aucune installation possible ;
 *   4. `start_url` et `scope` du manifeste visent la racine → l'icône installée ouvre une page vide ;
 *   5. les icônes et les raccourcis du manifeste restent à la racine → icône par défaut d'Android.
 *
 * Les points 3 à 5 ne se constatent qu'après publication, sur un vrai téléphone. Ce script les
 * constate avant, en construisant pour le sous-chemin puis en servant le résultat **comme Pages le
 * sert** : rien à la racine, tout sous le sous-chemin.
 *
 *   node scripts/verifier-pages.mjs [base]        (par défaut /logiciel_app-resto/)
 *
 * Aucun serveur d'API n'est nécessaire : cette construction n'en a pas, et c'est justement ce
 * qu'elle doit savoir dire à l'utilisateur.
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { webkit, chromium, devices } from 'playwright';

const BASE = process.argv[2] ?? '/logiciel_app-resto/';
const PORT = Number(process.env.PORT ?? 4700);
const RACINE = resolve('apps/client/dist');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ok = [], ko = [];
const v = (libelle, passe, detail = '') => {
  (passe ? ok : ko).push(libelle);
  console.log(`  ${passe ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` — ${detail}` : ''}`);
};

// ── 1. Construire pour le sous-chemin ──────────────────────────────────────────
console.log(`Construction pour ${BASE} …`);
const build = spawnSync('npm', ['run', 'build', '--workspace', '@savora/client'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: BASE, VITE_ASK_SERVER: '1' },
});
if (build.status !== 0) {
  console.error('\n  ⚠  La construction a échoué : rien à vérifier.\n');
  process.exit(1);
}

// ── 2. Contrôles sur les fichiers produits ────────────────────────────────────
console.log('\n── Fichiers produits ──');
const manifeste = JSON.parse(await readFile(join(RACINE, 'manifest.webmanifest'), 'utf8'));
const html = await readFile(join(RACINE, 'index.html'), 'utf8');

v('Les scripts de la page visent le sous-chemin', html.includes(`src="${BASE}`),
  (html.match(/src="[^"]+"/) ?? ['aucun'])[0]);
v('Le manifeste démarre sur le sous-chemin', manifeste.start_url === BASE, manifeste.start_url);
v('Le périmètre du manifeste est le sous-chemin', manifeste.scope === BASE, manifeste.scope);
v('Les icônes du manifeste sont sous le sous-chemin',
  manifeste.icons.every((i) => i.src.startsWith(BASE)),
  manifeste.icons.map((i) => i.src).join(' · '));
v('Les raccourcis du manifeste sont sous le sous-chemin',
  (manifeste.shortcuts ?? []).every((r) => r.url.startsWith(BASE)),
  (manifeste.shortcuts ?? []).map((r) => r.url).join(' · ') || 'aucun raccourci');
v('Un service worker est produit', existsSync(join(RACINE, 'sw.js')));
v('Une page de repli 404.html est produite', existsSync(join(RACINE, '404.html')),
  'sans elle, un lien partagé tombe sur la page d\'erreur de l\'hébergeur');

// ── 3. Servir exactement comme GitHub Pages ───────────────────────────────────
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://interne');

  // Hors du sous-chemin, Pages ne sert rien : c'est le piège que ce serveur doit reproduire.
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('404 — hors du sous-chemin');
    return;
  }

  const relatif = url.pathname.slice(BASE.length) || 'index.html';
  let chemin = join(RACINE, decodeURIComponent(relatif));
  let statut = 200;
  if (!chemin.startsWith(RACINE)) {
    res.writeHead(403).end('interdit');
    return;
  }
  if (!existsSync(chemin) || statSync(chemin).isDirectory()) {
    // Pages ne connaît pas le repli SPA : `404.html` est sa seule porte de sortie, et Vite en
    // dépose une copie de l'index. Servir autre chose ici mentirait sur le comportement réel.
    if (extname(relatif)) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('introuvable');
      return;
    }
    chemin = join(RACINE, existsSync(join(RACINE, '404.html')) ? '404.html' : 'index.html');
    statut = 404;  // Pages répond bien 404 sur cette page : le navigateur l'exécute quand même.
  }
  res.writeHead(statut, {
    'content-type': TYPES[extname(chemin)] ?? 'application/octet-stream',
    'cache-control': chemin.endsWith('sw.js') ? 'no-cache' : 'public, max-age=600',
  });
  res.end(await readFile(chemin));
});
/*
 * Le port déjà pris ne doit pas produire une trace de pile : on le dit en une ligne. Le cas arrive
 * dès qu'une vérification précédente a laissé son serveur derrière elle.
 */
await new Promise((pret, echec) => {
  serveur.once('error', (erreur) => {
    echec(erreur.code === 'EADDRINUSE'
      ? new Error(`Le port ${PORT} est déjà utilisé. Fermez l'autre serveur, ou : PORT=4701 node scripts/verifier-pages.mjs`)
      : erreur);
  });
  serveur.listen(PORT, '127.0.0.1', pret);
});
const ADRESSE = `http://127.0.0.1:${PORT}${BASE}`;
console.log(`\nServi comme GitHub Pages sur ${ADRESSE}`);

// ── 4. Les deux moteurs ───────────────────────────────────────────────────────
for (const [nom, moteur, appareil] of [
  ['Safari / iPhone', webkit, devices['iPhone 13']],
  ['Chrome / Android', chromium, devices['Pixel 7']],
]) {
  console.log(`\n── ${nom} ──`);
  const navigateur = await moteur.launch(moteur === chromium ? { executablePath: CHROME } : {});
  const contexte = await navigateur.newContext({ ...appareil });
  const page = await contexte.newPage();

  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  const manquants = [];
  page.on('response', (r) => {
    if (r.status() >= 400) manquants.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  await page.goto(ADRESSE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const texte = await page.locator('body').innerText();
  v("L'application se charge sous le sous-chemin", texte.length > 20,
    texte.replace(/\n+/g, ' | ').slice(0, 70));
  v("Elle demande l'adresse de son serveur", /adresse|serveur/i.test(texte));
  v('Aucun fichier manquant', manquants.length === 0, manquants.slice(0, 3).join(' · ') || 'aucun');
  v('Aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));

  const lu = await page.evaluate(async () => {
    const lien = document.querySelector('link[rel="manifest"]');
    if (!lien) return null;
    const reponse = await fetch(lien.href);
    return reponse.ok ? await reponse.json() : null;
  });
  v('Manifeste lisible depuis la page', Boolean(lu), lu ? lu.name : '');
  if (lu) {
    const statut = await page.evaluate(async (src) => (await fetch(src)).status, lu.icons[0].src);
    v("L'icône du manifeste est réellement servie", statut === 200, `HTTP ${statut}`);
  }

  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'absent';
    const enregistrement = await navigator.serviceWorker.getRegistration();
    return enregistrement ? `actif, périmètre ${new URL(enregistrement.scope).pathname}` : 'non enregistré';
  });
  v('Service worker actif sous le bon périmètre', sw.includes(BASE), sw);

  // Une adresse profonde, comme celle qu'on partage ou qu'on rouvre depuis l'écran d'accueil.
  await page.goto(`${ADRESSE}menu`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const surMenu = await page.locator('body').innerText();
  v('Une adresse profonde ne tombe pas sur « introuvable »', !/introuvable|not found/i.test(surMenu),
    surMenu.replace(/\n+/g, ' | ').slice(0, 60));

  await navigateur.close();
}

serveur.close();
console.log(`\n═════ ${ok.length} passées, ${ko.length} en échec ═════`);
ko.forEach((k) => console.log('  ✗', k));
process.exit(ko.length ? 1 : 0);

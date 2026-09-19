/**
 * Sert l'application cliente **construite**, et relaie l'API.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Le mode développement ne dit pas la vérité sur la PWA.                      │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * En développement, Vite sert les sources une à une et le service worker est désactivé : on ne peut
 * donc y vérifier ni le hors ligne, ni le manifeste, ni la mise en cache — c'est-à-dire rien de ce
 * qui fait une PWA. Il faut servir `dist/` comme le fera un vrai hébergeur, avec le repli SPA et le
 * relais d'API que ce dernier assurera.
 *
 * `vite preview` fait cela, mais refuse de tenir dans un processus d'arrière-plan ici : d'où ce
 * serveur minuscule, qui a l'avantage d'être lisible en entier.
 *
 * ── Une leçon payée ──
 * La première version relayait la méthode et les en-têtes, mais **pas le corps** de la requête.
 * L'API recevait donc un POST annonçant du JSON sans JSON, et répondait « Body cannot be empty ».
 * Aucune commande ne pouvait aboutir, et le défaut ressemblait trait pour trait à un bug de
 * l'application. Un relais qui perd le corps des requêtes est un relais qui ment : c'est la seule
 * chose que ce fichier doit faire parfaitement.
 *
 *   node scripts/servir-production.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const AMONT = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';
const RACINE = resolve('apps/client/dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** En-têtes propres à une connexion : les recopier d'un bout à l'autre casse le relais. */
const SAUT_A_SAUT = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length',
]);

function lireCorps(req) {
  return new Promise((resoudre, rejeter) => {
    const morceaux = [];
    req.on('data', (m) => morceaux.push(m));
    req.on('end', () => resoudre(Buffer.concat(morceaux)));
    req.on('error', rejeter);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://interne');

  // ── Relais de l'API et des médias ──
  if (url.pathname.startsWith('/api')) {
    try {
      const sansCorps = req.method === 'GET' || req.method === 'HEAD';
      const corps = sansCorps ? undefined : await lireCorps(req);

      const entrantes = Object.fromEntries(
        Object.entries(req.headers).filter(([nom]) => !SAUT_A_SAUT.has(nom.toLowerCase())),
      );

      const amont = await fetch(`${AMONT}${req.url}`, {
        method: req.method,
        headers: entrantes,
        body: corps && corps.length ? corps : undefined,
        redirect: 'manual',
      });

      // Toutes les en-têtes de réponse, pas seulement le type : sans elles on perdrait les cookies
      // de session, et l'authentification ne tiendrait pas d'une requête à l'autre.
      const sortantes = {};
      amont.headers.forEach((valeur, nom) => {
        if (!SAUT_A_SAUT.has(nom.toLowerCase())) sortantes[nom] = valeur;
      });
      res.writeHead(amont.status, sortantes);
      res.end(Buffer.from(await amont.arrayBuffer()));
    } catch (erreur) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'AMONT_INJOIGNABLE', message: String(erreur) } }));
    }
    return;
  }

  // ── Fichiers construits ──
  let chemin = join(RACINE, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));

  // Hors de la racine : une adresse comme /../etc/passwd n'a rien à faire ici.
  if (!chemin.startsWith(RACINE)) {
    res.writeHead(403).end('interdit');
    return;
  }

  if (!existsSync(chemin) || statSync(chemin).isDirectory()) {
    // Repli SPA — mais jamais pour un fichier attendu : servir du HTML à la place d'un script
    // produit une erreur que personne ne sait lire.
    if (extname(url.pathname)) {
      res.writeHead(404).end('introuvable');
      return;
    }
    chemin = join(RACINE, 'index.html');
  }

  const type = TYPES[extname(chemin)] ?? 'application/octet-stream';
  // Le service worker ne se met jamais en cache : figé, il gèlerait l'application sur une version.
  const cache = chemin.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { 'content-type': type, 'cache-control': cache });
  res.end(await readFile(chemin));
}).listen(PORT, '0.0.0.0', () => {
  if (!existsSync(RACINE)) {
    console.error(`\n  ⚠  ${RACINE} n'existe pas. Construisez d'abord : npm run build --workspace @savora/client\n`);
  }
  console.log(`  Construction servie sur http://127.0.0.1:${PORT}  (API relayée vers ${AMONT})`);
});

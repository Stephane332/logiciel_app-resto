/**
 * Le petit serveur qui fait tenir le logiciel Windows.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une interface chargée en `file://` n'est pas une page web : c'est un fichier.│
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'interface était ouverte avec `loadFile()`, donc sur une origine `file://`. Trois défauts en
 * découlaient, tous mesurés sur l'application empaquetée :
 *
 *   1. **Page blanche.** Le routeur réécrit l'adresse du document à chaque navigation. Depuis
 *      `file:///…/web/index.html`, elle devient `file:///connexion` — un chemin qui n'existe pas.
 *      Tant que personne ne recharge, l'affichage tient ; au premier rechargement, Windows cherche
 *      un fichier nommé « connexion » à la racine du disque, ne le trouve pas, et affiche le vide.
 *      C'est le réflexe de tout le monde devant un logiciel qui bloque : appuyer sur rafraîchir.
 *
 *   2. **Aucun appel d'API ne peut aboutir.** Une page `file://` envoie `Origin: null`. Le serveur
 *      répond bien — 200, mesuré — mais sans en-tête `Access-Control-Allow-Origin`, et le
 *      navigateur jette donc la réponse. Le logiciel s'affichait, et ne pouvait rien faire.
 *
 *   3. **Le stockage local est une zone commune** sur `file://`, partagée entre tous les fichiers
 *      ouverts : ce n'est pas un endroit où garder une session de caisse.
 *
 * La correction ne consiste pas à traiter les trois séparément, mais à supprimer leur cause : on
 * sert l'interface depuis une véritable origine, `http://127.0.0.1:port`, à l'intérieur même de
 * l'application. Et comme ce serveur relaie aussi `/api` et `/realtime` vers le serveur du
 * restaurant, tout devient **de même origine** — plus de CORS à régler, aucune adresse à figer dans
 * l'interface, et exactement le montage qui tourne déjà en production derrière Caddy.
 *
 * Rien n'est exposé au réseau : l'écoute est sur 127.0.0.1, sur un port choisi par le système.
 */
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');

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
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** En-têtes propres à une connexion : les recopier casse le relais. */
const SAUT_A_SAUT = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

function estRelais(chemin) {
  return chemin.startsWith('/api') || chemin.startsWith('/realtime');
}

/**
 * Démarre le serveur local.
 *
 * `amont` est l'adresse du serveur du restaurant, telle qu'elle a été saisie une fois pour toutes.
 * Elle peut changer sans redémarrer : `definirAmont` suffit, et la fenêtre se recharge.
 */
function demarrer({ racine }) {
  let amont = null;

  const serveur = http.createServer((requete, reponse) => {
    const url = new URL(requete.url, 'http://interne');

    // ── Relais vers le serveur du restaurant ──
    if (estRelais(url.pathname)) {
      if (!amont) {
        reponse.writeHead(503, { 'content-type': 'application/json' });
        reponse.end(JSON.stringify({ error: { code: 'SERVEUR_NON_CONFIGURE', message: 'Aucun serveur configuré.' } }));
        return;
      }

      const cible = new URL(amont);
      const transport = cible.protocol === 'https:' ? https : http;
      const entetes = { ...requete.headers, host: cible.host };
      for (const nom of SAUT_A_SAUT) delete entetes[nom];
      entetes.host = cible.host;

      const relais = transport.request(
        {
          protocol: cible.protocol,
          hostname: cible.hostname,
          port: cible.port || (cible.protocol === 'https:' ? 443 : 80),
          method: requete.method,
          path: requete.url,
          headers: entetes,
        },
        (amontReponse) => {
          reponse.writeHead(amontReponse.statusCode ?? 502, amontReponse.headers);
          amontReponse.pipe(reponse);
        },
      );

      // Le serveur injoignable est le cas normal d'un restaurant : coupure, panne, mauvaise adresse.
      // L'interface sait afficher une erreur lisible — à condition de recevoir une réponse.
      relais.on('error', (erreur) => {
        if (reponse.headersSent) {
          reponse.destroy();
          return;
        }
        reponse.writeHead(502, { 'content-type': 'application/json' });
        reponse.end(JSON.stringify({
          error: { code: 'SERVEUR_INJOIGNABLE', message: `Serveur injoignable : ${erreur.message}` },
        }));
      });

      requete.pipe(relais);
      return;
    }

    // ── Interface embarquée ──
    let chemin = path.join(racine, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!chemin.startsWith(racine)) {
      reponse.writeHead(403).end('interdit');
      return;
    }

    let infos = null;
    try {
      infos = fs.statSync(chemin);
    } catch {
      infos = null;
    }

    if (!infos || infos.isDirectory()) {
      // Repli de l'application à page unique — mais jamais pour un fichier attendu : servir du HTML
      // à la place d'un script produit une erreur que personne ne sait lire.
      if (path.extname(url.pathname)) {
        reponse.writeHead(404).end('introuvable');
        return;
      }
      chemin = path.join(racine, 'index.html');
    }

    try {
      const contenu = fs.readFileSync(chemin);
      reponse.writeHead(200, {
        'content-type': TYPES[path.extname(chemin)] ?? 'application/octet-stream',
        // L'interface est empaquetée avec l'exe : elle ne change qu'à la mise à jour du logiciel.
        'cache-control': 'no-cache',
      });
      reponse.end(contenu);
    } catch (erreur) {
      reponse.writeHead(500).end(String(erreur.message));
    }
  });

  /**
   * Mise à niveau websocket, pour le temps réel.
   *
   * Sans elle, la commande n'arrive pas en cuisine en direct : l'interface retombe sur son
   * rechargement périodique, le service marche, et personne ne voit que vingt secondes ont remplacé
   * deux.
   */
  serveur.on('upgrade', (requete, socket, tete) => {
    if (!amont || !estRelais(requete.url)) {
      socket.destroy();
      return;
    }

    const cible = new URL(amont);
    const securise = cible.protocol === 'https:';
    const port = Number(cible.port || (securise ? 443 : 80));
    const options = { host: cible.hostname, port, servername: cible.hostname };
    const amontSocket = securise ? tls.connect(options) : net.connect(port, cible.hostname);

    amontSocket.on(securise ? 'secureConnect' : 'connect', () => {
      const entetes = Object.entries(requete.headers)
        .filter(([nom]) => nom.toLowerCase() !== 'host')
        .map(([nom, valeur]) => `${nom}: ${valeur}`)
        .join('\r\n');
      amontSocket.write(`${requete.method} ${requete.url} HTTP/1.1\r\nHost: ${cible.host}\r\n${entetes}\r\n\r\n`);
      if (tete && tete.length) amontSocket.write(tete);
      amontSocket.pipe(socket);
      socket.pipe(amontSocket);
    });

    // Une extrémité qui tombe emporte l'autre : un demi-tunnel laisse la page attendre sans fin.
    amontSocket.on('error', () => socket.destroy());
    socket.on('error', () => amontSocket.destroy());
  });

  return new Promise((resoudre, rejeter) => {
    serveur.on('error', rejeter);
    // Port 0 : le système en choisit un libre. Un port fixe finirait par tomber sur celui d'un autre
    // logiciel du poste de caisse, et le conflit serait incompréhensible pour le restaurateur.
    serveur.listen(0, '127.0.0.1', () => {
      const { port } = serveur.address();
      resoudre({
        origine: `http://127.0.0.1:${port}`,
        definirAmont: (valeur) => {
          amont = valeur;
        },
        arreter: () => serveur.close(),
      });
    });
  });
}

module.exports = { demarrer };

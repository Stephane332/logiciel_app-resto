/**
 * Ouvre un lien HTTPS public et temporaire vers l'application cliente.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Pour essayer sur un iPhone, il faut du HTTPS. Pas d'exception.               │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Sur le réseau local (`npm run demarrer`), l'adresse est en clair : un Android l'ouvre et s'en
 * sert, mais Safari refuse d'installer une application depuis une adresse non sécurisée, et le
 * service worker n'y démarre pas. Un iPhone ne peut donc rien essayer par ce chemin — et il ne peut
 * pas non plus installer l'APK.
 *
 * Ce script comble ce trou **le temps d'un essai**. Il sert la construction de production et
 * l'expose par un tunnel Cloudflare, qui fournit une véritable adresse en `https://…`. Un iPhone
 * l'ouvre dans Safari, installe l'application, commande, et suit sa commande en direct.
 *
 * ── Ce n'est pas de la production ──
 *
 * L'adresse change à chaque lancement, elle meurt avec le script, et tout passe par l'ordinateur qui
 * le fait tourner. C'est un banc d'essai, pas un service. La vraie adresse — celle qu'on imprime sur
 * une affiche et qu'on donne à ses clients — demande un nom de domaine et un serveur :
 * `docs/deploiement.md`, une commande, et Caddy s'occupe du certificat.
 *
 *   node scripts/partager.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 4173;
const API = 'http://127.0.0.1:4000/health';

function ligne(texte = '') {
  console.log(texte);
}

// ── Ce qui doit être prêt avant de partager quoi que ce soit ──

if (!existsSync(resolve('apps/client/dist/index.html'))) {
  ligne('\n  ⚠  L\'application n\'est pas construite.\n');
  ligne('     npm run build --workspace @savora/client\n');
  process.exit(1);
}

try {
  const sante = await fetch(API, { signal: AbortSignal.timeout(2500) });
  if (!sante.ok) throw new Error(String(sante.status));
} catch {
  ligne('\n  ⚠  L\'API ne répond pas sur le port 4000.\n');
  ligne('     Lancez « npm run dev » dans un autre terminal, puis relancez celui-ci.\n');
  process.exit(1);
}

/** Le tunnel a besoin de l'outil de Cloudflare. Rien à créer, aucun compte. */
function expliquerInstallation() {
  ligne('\n  ⚠  cloudflared n\'est pas installé. C\'est le seul prérequis.\n');
  ligne('     Linux    : sudo apt install cloudflared');
  ligne('     macOS    : brew install cloudflared');
  ligne('     Windows  : winget install --id Cloudflare.cloudflared');
  ligne('\n     Puis relancez : node scripts/partager.mjs\n');
}

// ── Le serveur local, puis le tunnel ──

const serveur = spawn(process.execPath, [resolve('scripts/servir-production.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
serveur.stdout.on('data', () => {});
serveur.stderr.on('data', (d) => process.stderr.write(d));

// Laisser le serveur prendre son port avant d'y envoyer un tunnel.
await new Promise((r) => setTimeout(r, 1200));

const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

tunnel.on('error', (erreur) => {
  if (erreur.code === 'ENOENT') expliquerInstallation();
  else ligne(`\n  ⚠  ${erreur.message}\n`);
  serveur.kill();
  process.exit(1);
});

let annonce = false;

/** cloudflared écrit l'adresse sur sa sortie d'erreur, au milieu de son journal. */
function chercherAdresse(texte) {
  if (annonce) return;
  const trouve = texte.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (!trouve) return;
  annonce = true;

  const adresse = trouve[0];
  ligne('');
  ligne('  ┌────────────────────────────────────────────────────────────────┐');
  ligne('  │  L\'application est en ligne, en HTTPS, pour la durée de cette  │');
  ligne('  │  session.                                                      │');
  ligne('  └────────────────────────────────────────────────────────────────┘');
  ligne('');
  ligne(`     ${adresse}`);
  ligne('');
  ligne('  Sur iPhone   Ouvrir dans **Safari** (pas Chrome : sur iOS, seul');
  ligne('               Safari sait installer une application). Bouton Partager,');
  ligne('               puis « Sur l\'écran d\'accueil ».');
  ligne('');
  ligne('  Sur Android  Ouvrir dans Chrome, menu ⋮, « Installer l\'application ».');
  ligne('');
  ligne('  À savoir     L\'adresse meurt avec ce script et change au prochain');
  ligne('               lancement. Tout passe par cet ordinateur : gardez-le');
  ligne('               allumé et connecté pendant l\'essai.');
  ligne('');
  ligne('  Ctrl+C pour arrêter.');
  ligne('');
}

tunnel.stderr.on('data', (d) => chercherAdresse(String(d)));
tunnel.stdout.on('data', (d) => chercherAdresse(String(d)));

tunnel.on('exit', (code) => {
  if (!annonce) ligne(`\n  ⚠  Le tunnel s'est arrêté (code ${code}) sans fournir d'adresse.\n`);
  serveur.kill();
  process.exit(code ?? 0);
});

function arreter() {
  tunnel.kill();
  serveur.kill();
  process.exit(0);
}
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);

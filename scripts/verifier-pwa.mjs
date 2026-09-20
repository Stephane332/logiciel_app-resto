/**
 * Vérifie que l'application cliente est réellement une PWA — pas seulement annoncée comme telle.
 *
 * Une PWA, ce n'est pas une case à cocher dans une configuration : c'est un manifeste servi et
 * lisible, un service worker enregistré et actif, des fichiers réellement mis en cache, et un menu
 * qui reste consultable une fois le réseau coupé (critère A14). Rien de tout cela n'est visible en
 * mode développement, où le service worker est désactivé : il faut servir la construction.
 *
 *   npm run build --workspace @savora/client
 *   npm run servir
 *   node scripts/verifier-pwa.mjs
 */
import { chromium } from 'playwright';
import { garantirCatalogue } from './lib/catalogue.mjs';

const URL = 'http://127.0.0.1:4173';
const API = 'http://127.0.0.1:4000/api/v1';
const ok = [], ko = [];
const v = (l, p, d = '') => { (p ? ok : ko).push(l); console.log(`${p ? '  OK  ' : ' ÉCHEC'} ${l}${d ? ` — ${d}` : ''}`); };

// --- De quoi avoir un menu à consulter hors ligne ---
console.log(`Menu : ${await garantirCatalogue(API)} produits\n`);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();

// --- 1. Le manifeste ---
const manifeste = await (await fetch(`${URL}/manifest.webmanifest`)).json();
v('Manifeste servi et lisible', Boolean(manifeste.name));
v('Nom et nom court présents', Boolean(manifeste.name && manifeste.short_name), `${manifeste.name} / ${manifeste.short_name}`);
v('Mode autonome (sans barre d\'adresse)', manifeste.display === 'standalone', manifeste.display);
v('Point de départ défini', Boolean(manifeste.start_url), manifeste.start_url);
v('Couleurs accordées à l\'interface claire', manifeste.background_color === '#fbf8f3' && manifeste.theme_color === '#fbf8f3',
  `${manifeste.background_color} / ${manifeste.theme_color}`);
const i192 = manifeste.icons.some(i => i.sizes === '192x192');
const i512 = manifeste.icons.some(i => i.sizes === '512x512');
const masq = manifeste.icons.some(i => (i.purpose ?? '').includes('maskable'));
v('Icônes 192 et 512 (exigées par Android)', i192 && i512);
v('Icône masquable (sinon Android rogne le logo)', masq);

// --- 2. Le service worker ---
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const sw = await p.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return { nb: regs.length, actif: Boolean(regs[0]?.active), portee: regs[0]?.scope ?? null };
});
v('Service worker enregistré', sw.nb > 0);
v('Service worker actif', sw.actif, sw.portee ?? '');

// --- 3. Mise en cache ---
const caches = await p.evaluate(async () => {
  const noms = await window.caches.keys();
  const detail = {};
  for (const n of noms) detail[n] = (await (await window.caches.open(n)).keys()).length;
  return detail;
});
v('Fichiers mis en cache', Object.values(caches).some(n => n > 0), JSON.stringify(caches));

// --- 4. Le menu, consulté puis coupé ---
await p.goto(`${URL}/menu`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const enLigne = await p.locator('.product-card').count();
v('Menu consultable en ligne', enLigne > 0, `${enLigne} produit(s)`);

await ctx.setOffline(true);
await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await p.waitForTimeout(3000);
const corps = await p.locator('body').innerText().catch(() => '');
const horsLigne = await p.locator('.product-card').count().catch(() => 0);
v('L\'application se charge encore hors ligne', corps.length > 40 && !/Cannot GET|ERR_/.test(corps));
v('Le menu reste consultable hors ligne (critère A14)', horsLigne > 0, `${horsLigne} produit(s)`);
const prevenu = /hors ligne|connexion|réseau/i.test(corps);
v('Le client est prévenu qu\'il est hors ligne', prevenu);

await ctx.setOffline(false);
await b.close();
console.log(`\n===== ${ok.length} passées, ${ko.length} en échec =====`);
ko.forEach(k => console.log('  ✗', k));
process.exit(ko.length ? 1 : 0);

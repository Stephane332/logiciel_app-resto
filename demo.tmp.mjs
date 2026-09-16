import { chromium } from 'playwright';

const API = 'http://127.0.0.1:4000/api/v1';
const CLIENT = 'http://127.0.0.1:5173';
const RESTO = 'http://127.0.0.1:5174';
const DIR = '/tmp/claude-0/-home-user-logiciel-app-resto/e04962c1-2fab-5b74-9993-b1c6c577f46b/scratchpad';

const login = async (phone) => (await (await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone, password: 'barabite2026' }),
})).json()).accessToken;

const token = await login('+22670000001');
const H = { 'content-type': 'application/json', authorization: `Bearer ${token}` };

// --- Le restaurant saisit son menu, comme il le ferait depuis le logiciel ---
const menu = [
  { cat: 'Burgers', produits: [
    { name: 'Double Cheese', price: 3500, description: 'Steak haché, cheddar fondu, salade, tomate, oignon, sauce maison.' },
    { name: 'Chicken Burger', price: 2800, description: 'Poulet grillé, crudités fraîches, sauce au choix.' },
    { name: 'Beef Burger', price: 2500, description: 'Steak haché, salade, tomate, oignon.' },
  ]},
  { cat: 'Wraps & Paninis', produits: [
    { name: 'Chicken Wrap', price: 2900, description: 'Poulet, crudités, sauce au choix, galette moelleuse.' },
    { name: 'Panini Poulet', price: 2000, description: 'Pain panini grillé, poulet, fromage fondu.' },
  ]},
  { cat: 'Menus', produits: [
    { name: 'Menu XL', price: 6500, description: 'Double Cheese + frites + boisson.' },
    { name: 'Menu Poulet', price: 5500, description: 'Chicken Burger + frites + boisson.' },
  ]},
  { cat: 'Accompagnements', produits: [
    { name: 'Frites maison', price: 1500, description: 'Portion généreuse, croustillantes.' },
    { name: 'Frites Cheese', price: 2000, description: 'Frites nappées de cheddar fondu.' },
  ]},
  { cat: 'Boissons', produits: [
    { name: 'Jus de bissap', price: 750, description: 'Préparation maison, servie bien fraîche.' },
    { name: 'Eau minérale', price: 500, description: 'Bouteille 50 cl.' },
  ]},
];

let position = 0;
for (const groupe of menu) {
  const c = await (await fetch(`${API}/menu/categories`, {
    method: 'POST', headers: H, body: JSON.stringify({ name: groupe.cat, position: position++ }),
  })).json();
  if (!c.category) { console.log('catégorie KO:', JSON.stringify(c).slice(0, 200)); continue; }
  let p = 0;
  for (const produit of groupe.produits) {
    const r = await (await fetch(`${API}/menu/products`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ categoryId: c.category.id, ...produit, position: p++ }),
    })).json();
    if (!r.product) console.log('produit KO:', JSON.stringify(r).slice(0, 200));
  }
}

const verif = await (await fetch(`${API}/menu`)).json();
const total = verif.categories.flatMap((c) => c.products).length;
const avecImage = verif.categories.flatMap((c) => c.products).filter((p) => p.imageUrl).length;
console.log(`Saisis depuis le logiciel : ${total} produits, ${avecImage} avec visuel automatique`);

// --- Captures ---
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const tel = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await tel.goto(`${CLIENT}/`, { waitUntil: 'networkidle' });
await tel.waitForTimeout(2000);
await tel.screenshot({ path: `${DIR}/neuf-accueil.png`, fullPage: true });
await tel.goto(`${CLIENT}/menu`, { waitUntil: 'networkidle' });
await tel.waitForTimeout(1800);
await tel.screenshot({ path: `${DIR}/neuf-menu.png`, fullPage: true });

const chargees = await tel.evaluate(() => [...document.images].filter((i) => i.naturalWidth > 0).length);
console.log(`Images chargées dans le menu client : ${chargees}`);

const pc = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await pc.goto(`${RESTO}/connexion`, { waitUntil: 'networkidle' });
await pc.waitForTimeout(800);
await pc.screenshot({ path: `${DIR}/neuf-connexion.png` });
await pc.locator('input').first().fill('70000001');
await pc.locator('input[type="password"]').fill('barabite2026');
await pc.getByRole('button', { name: /Connexion|Se connecter/i }).click();
await pc.waitForURL((u) => !u.href.includes('/connexion'), { timeout: 15000 });
await pc.waitForTimeout(2000);
await pc.screenshot({ path: `${DIR}/neuf-logiciel.png` });
await pc.goto(`${RESTO}/menu`, { waitUntil: 'networkidle' });
await pc.waitForTimeout(1800);
await pc.screenshot({ path: `${DIR}/neuf-logiciel-menu.png` });

await b.close();
console.log('captures faites');

/**
 * Rejoue le parcours de chaque rôle, dans un vrai navigateur, sur la construction de production.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Les tests unitaires disent que les règles sont justes. Ils ne disent pas     │
 * │  qu'un client peut commander.                                                │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Ce script existe à cause d'un défaut précis. Le bouton « Commander » du panier était dessiné sous
 * la navigation basse : visible, à moitié, et sourd au doigt. Aucun test d'intégration ne pouvait le
 * voir — l'API répondait parfaitement, les règles métier étaient justes, les 202 tests étaient verts,
 * et l'application était inutilisable. Seul un doigt posé à l'endroit exact du bouton révèle ce
 * genre de chose.
 *
 * Il vérifie donc ce qu'aucune autre couche ne vérifie : qu'un client sans compte peut aller du menu
 * au code de retrait, que chaque poste du restaurant voit ce qu'il doit voir **et rien de plus**, et
 * que le cloisonnement tient quand un employé tape une adresse interdite à la main.
 *
 *   Prérequis :  npm run dev            (API sur :4000)
 *                npm run dev:restaurant (logiciel sur :5174)
 *                npm run build --workspace @savora/client && npm run servir   (client sur :4173)
 *
 *   node scripts/verifier-parcours.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://127.0.0.1:4000/api/v1';
const CLIENT = process.env.CLIENT_URL ?? 'http://127.0.0.1:4173';
const RESTO = process.env.RESTO_URL ?? 'http://127.0.0.1:5174';
const MOT_DE_PASSE = process.env.DEMO_PASSWORD ?? 'savora2026';

/** Comptes du jeu de démarrage. */
const COMPTES = { admin: '70000001', gerant: '70000002', caisse: '70000003', cuisine: '70000004', livreur: '70000005' };

const reussies = [];
const echecs = [];

function v(libelle, passe, detail = '') {
  (passe ? reussies : echecs).push(libelle);
  console.log(`  ${passe ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` — ${detail}` : ''}`);
}

/** Chromium est préinstallé dans cet environnement ; ailleurs, Playwright trouve le sien. */
function chercherNavigateur() {
  const candidats = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].filter(Boolean);
  return candidats.find((c) => existsSync(c));
}

/**
 * Le doigt touche-t-il réellement ce bouton ?
 *
 * « Visible » ne veut pas dire « atteignable ». Un bouton recouvert par une barre fixée reste
 * visible, mesure la bonne taille, passe tous les contrôles d'accessibilité — et ne répond pas. On
 * interroge donc le navigateur à l'endroit exact où le client poserait le doigt, et on vérifie que
 * c'est bien ce bouton qu'il rencontre.
 */
async function atteignable(locator) {
  const boite = await locator.boundingBox();
  if (!boite) return false;
  return locator.evaluate(
    (bouton, point) => {
      const dessus = document.elementFromPoint(point.x, point.y);
      return Boolean(dessus) && (bouton === dessus || bouton.contains(dessus));
    },
    { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 },
  );
}

/** Le menu latéral du logiciel, tel qu'un employé le lit. */
async function menuLateral(page) {
  const barre = page.locator('.sidebar').first();
  if (await barre.count()) return barre.innerText();
  return page.locator('nav').first().innerText();
}

const executable = chercherNavigateur();
const navigateur = await chromium.launch(executable ? { executablePath: executable } : {});

async function connecter(page, telephone) {
  await page.goto(`${RESTO}/connexion`, { waitUntil: 'networkidle' });
  await page.locator('input').first().fill(telephone);
  await page.locator('input[type="password"]').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: /Connexion|Se connecter/i }).click();
  await page.waitForURL((u) => !u.href.includes('/connexion'), { timeout: 20000 });
  await page.waitForTimeout(1500);
}

/** Remplit un panier d'un produit et s'arrête sur l'écran de commande. */
async function jusquAuPaiement(page) {
  await page.goto(`${CLIENT}/menu`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  const carte = page.locator('a[href^="/produit/"], .product-card').first();
  await carte.waitFor({ timeout: 20000 });
  await carte.click();
  await page.waitForURL('**/produit/**', { timeout: 15000 });
  await page.waitForTimeout(800);
  const ajouter = page.getByRole('button', { name: /Ajouter au panier/i }).first();
  await ajouter.waitFor({ timeout: 15000 });
  return ajouter;
}

let idCommande = null;
let codeRetrait = null;

try {
  // ════════════════════ 1. LE CLIENT, SUR SON TÉLÉPHONE ════════════════════
  console.log('\n── Le client, sur son téléphone (390 px) ──');
  const telephone = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const client = await telephone.newPage();
  client.on('pageerror', (e) => echecs.push(`[erreur client] ${e.message}`));

  const ajouter = await jusquAuPaiement(client);
  v("Aucun supplément n'est imposé pour ajouter au panier", await ajouter.isEnabled());
  v("Le bouton « Ajouter au panier » répond au doigt", await atteignable(ajouter));
  await ajouter.click();
  await client.waitForTimeout(900);

  await client.goto(`${CLIENT}/panier`, { waitUntil: 'networkidle' });
  await client.waitForTimeout(900);
  const commander = client.getByRole('button', { name: /Commander/i }).first();
  v('Le panier retient le produit', (await commander.count()) > 0);
  // Le défaut qui a justifié ce script : la navigation basse recouvrait ce bouton.
  v('Le bouton « Commander » répond au doigt', await atteignable(commander));
  await commander.click();
  await client.waitForURL('**/commander', { timeout: 15000 });
  await client.waitForTimeout(900);

  const valider = client.getByRole('button', { name: /^Valider/i }).first();
  v("Le bouton « Valider » de la commande répond au doigt", await atteignable(valider));

  await client.getByRole('button', { name: /récupérer/i }).first().click();
  await client.waitForTimeout(500);
  await client.locator('#name').fill('Awa Ouédraogo');
  await client.locator('#phone').fill('70 55 66 77');
  await client.getByRole('button', { name: /^Valider/i }).first().click();
  await client.waitForURL('**/commande/**', { timeout: 25000 });
  idCommande = client.url().match(/commande\/([^/?]+)/)[1];
  v('La commande passe sans créer de compte', Boolean(idCommande));

  // Le code arrive avec la réponse du serveur : il faut laisser l'écran se peindre.
  await client.waitForTimeout(2500);
  const suivi = await client.locator('body').innerText();
  const trouve = suivi.match(/\b[ACDEFGHJKMNPQRTUVWXYZ2346789]{5}\b/);
  codeRetrait = trouve?.[0] ?? null;
  v('Un code de retrait lisible est donné au client', Boolean(codeRetrait), codeRetrait ?? '');

  // ════════════════════ 2. LA CAISSE, AU COMPTOIR ════════════════════
  console.log('\n── La caisse, au comptoir ──');
  const caisse = await (await navigateur.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await connecter(caisse, COMPTES.caisse);

  const menuCaisse = await menuLateral(caisse);
  v('La caisse voit la caisse', /Caisse/i.test(menuCaisse));
  v('La caisse ne voit pas la commission', !/Commission/i.test(menuCaisse));

  await caisse.goto(`${RESTO}/commandes`, { waitUntil: 'networkidle' });
  await caisse.waitForTimeout(2000);
  const texteCaisse = await caisse.locator('body').innerText();
  v('La commande du client arrive chez la caisse', /Awa|Application/i.test(texteCaisse));
  v('Le code de retrait est visible au comptoir', Boolean(codeRetrait) && texteCaisse.includes(codeRetrait));

  const accepter = caisse.getByRole('button', { name: /^Accepter/i }).first();
  v('La caisse peut accepter', (await accepter.count()) > 0);
  if (await accepter.count()) {
    await accepter.click();
    await caisse.waitForTimeout(1800);
  }

  // ════════════════════ 3. LA CUISINE, SUR SA TABLETTE ════════════════════
  console.log('\n── La cuisine, sur sa tablette ──');
  const cuisine = await (await navigateur.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await connecter(cuisine, COMPTES.cuisine);

  const menuCuisine = await menuLateral(cuisine);
  v('La cuisine a bien un menu lisible', menuCuisine.trim().length > 0);
  v('La cuisine ne voit pas la caisse', !/Caisse/i.test(menuCuisine));
  v('La cuisine ne voit pas les statistiques', !/Statistiques/i.test(menuCuisine));
  v('La cuisine ne voit pas la commission', !/Commission/i.test(menuCuisine));
  v('La cuisine ne voit pas les paiements', !/Paiements/i.test(menuCuisine));

  await cuisine.goto(`${RESTO}/cuisine`, { waitUntil: 'networkidle' });
  await cuisine.waitForTimeout(2000);
  const texteCuisine = await cuisine.locator('body').innerText();
  v('La commande est arrivée en cuisine', /Awa|Double Cheese|Chicken|#00/i.test(texteCuisine));

  const commencer = cuisine.getByRole('button', { name: /Commencer/i }).first();
  v('La cuisine peut lancer la préparation', (await commencer.count()) > 0);
  if (await commencer.count()) {
    await commencer.click();
    await cuisine.waitForTimeout(1800);
  }
  const prete = cuisine.getByRole('button', { name: /prête/i }).first();
  v('La cuisine peut annoncer la commande prête', (await prete.count()) > 0);
  if (await prete.count()) {
    await prete.click();
    await cuisine.waitForTimeout(1800);
  }

  // Masquer un bouton n'est qu'une politesse : c'est le serveur qui doit refuser.
  for (const interdit of ['/caisse', '/statistiques', '/commission', '/paiements', '/employes']) {
    await cuisine.goto(`${RESTO}${interdit}`, { waitUntil: 'networkidle' });
    await cuisine.waitForTimeout(1000);
    v(`La cuisine est refoulée de ${interdit}`, !cuisine.url().endsWith(interdit), cuisine.url().replace(RESTO, '') || '/');
  }
  // Refoulée vers son propre écran, et non vers le tableau de bord : le chiffre d'affaires du
  // restaurant n'est pas l'affaire de la cuisine.
  const arrivee = await cuisine.locator('body').innerText();
  v("La cuisine atterrit sur sa file, pas sur le chiffre d'affaires", !/Chiffre d'affaires/i.test(arrivee));

  // ════════════════════ 4. LE CLIENT EST PRÉVENU, SANS RIEN FAIRE ════════════════════
  console.log('\n── Le client, prévenu en direct ──');
  await client.waitForTimeout(3000);
  const suiviFinal = await client.locator('body').innerText();
  v('Le suivi du client a avancé sans rechargement', /[Pp]rête|préparation/.test(suiviFinal));

  // ════════════════════ 5. LA REMISE CONTRE CODE ════════════════════
  console.log('\n── La remise au comptoir ──');
  await caisse.goto(`${RESTO}/commandes`, { waitUntil: 'networkidle' });
  await caisse.waitForTimeout(2000);
  const onglet = caisse.getByRole('tab', { name: /Prêtes/i }).first();
  if (await onglet.count()) {
    await onglet.click();
    await caisse.waitForTimeout(1500);
  }
  const remettre = caisse.getByRole('button', { name: /Remettre au client/i }).first();
  v('La remise contre code est proposée sur les commandes prêtes', (await remettre.count()) > 0);

  // ════════════════════ 6. LE LIVREUR NE VOIT QUE SES LIVRAISONS ════════════════════
  console.log('\n── Le livreur, sur son téléphone ──');
  const livreur = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await connecter(livreur, COMPTES.livreur);
  const menuLivreur = await menuLateral(livreur);
  v('Le livreur arrive sur sa tournée', livreur.url().endsWith('/livraisons'), livreur.url().replace(RESTO, ''));
  v('Le livreur voit « Ma tournée »', /Ma tournée/i.test(menuLivreur));
  v('Le livreur ne voit pas la caisse', !/Caisse/i.test(menuLivreur));
  v('Le livreur ne voit pas le menu du restaurant', !/\bMenu\b/.test(menuLivreur));
  v('Le livreur ne voit pas les statistiques', !/Statistiques/i.test(menuLivreur));
  v('Le livreur ne voit pas le tableau de bord', !/Tableau de bord/i.test(menuLivreur));
  const ecranLivreur = await livreur.locator('body').innerText();
  v("Le livreur ne voit pas le chiffre d'affaires", !/Chiffre d'affaires/i.test(ecranLivreur));

  // Et le serveur, lui, refuse — c'est le seul refus qui compte.
  const jetonLivreur = (await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: COMPTES.livreur, password: MOT_DE_PASSE }),
  })).json()).accessToken;
  const fileRefusee = await fetch(`${API}/orders`, { headers: { authorization: `Bearer ${jetonLivreur}` } });
  v('Le serveur refuse la file du restaurant au livreur', fileRefusee.status === 403, `HTTP ${fileRefusee.status}`);
  const tournee = await fetch(`${API}/delivery/mine`, { headers: { authorization: `Bearer ${jetonLivreur}` } });
  v('Le serveur sert bien sa tournée au livreur', tournee.status === 200, `HTTP ${tournee.status}`);

  // ════════════════════ 7. LE GÉRANT ════════════════════
  console.log('\n── Le gérant ──');
  const gerant = await (await navigateur.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await connecter(gerant, COMPTES.gerant);
  const menuGerant = await menuLateral(gerant);
  v('Le gérant voit les statistiques', /Statistiques/i.test(menuGerant));
  v('Le gérant voit la commission', /Commission/i.test(menuGerant));

  await gerant.goto(`${RESTO}/commission`, { waitUntil: 'networkidle' });
  await gerant.waitForTimeout(2200);
  const texteCommission = await gerant.locator('body').innerText();
  v('Le taux de commission est affiché en clair', /1\s*%/.test(texteCommission));

  // ════════════════════ 8. CE QUE LE CLIENT NE DOIT JAMAIS VOIR ════════════════════
  console.log('\n── Ce qui ne doit jamais fuir côté client ──');
  const vue = await (await fetch(`${API}/orders/${idCommande}/track`)).text();
  v("La commission n'apparaît jamais dans le suivi client", !/commission/i.test(vue));
  v("Le suivi client ne révèle aucun identifiant d'employé", !/actorId":"c/i.test(vue));

  // Le serveur refuse-t-il vraiment la cuisine sur un écran d'argent ?
  const jeton = (await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: COMPTES.cuisine, password: MOT_DE_PASSE }),
  })).json()).accessToken;
  const refus = await fetch(`${API}/commission/summary`, { headers: { authorization: `Bearer ${jeton}` } });
  v('Le serveur refuse la commission à la cuisine', refus.status === 401 || refus.status === 403, `HTTP ${refus.status}`);
} finally {
  await navigateur.close();
}

console.log(`\n═════ ${reussies.length} passées, ${echecs.length} en échec ═════`);
echecs.forEach((e) => console.log('  ✗', e));
process.exit(echecs.length ? 1 : 0);

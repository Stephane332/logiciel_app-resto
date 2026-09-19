/**
 * Vérifie l'application cliente sur iPhone, dans le moteur de Safari.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un iPhone n'installe pas d'APK. La PWA est sa seule voie.                    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Tout le reste du projet est vérifié dans Chromium — et Chromium n'est pas Safari. WebKit a son
 * propre moteur de rendu, sa propre gestion du plein écran, ses propres règles d'installation sur
 * l'écran d'accueil. Un défaut qui n'existe que là toucherait la moitié des clients sans que rien
 * ne le signale.
 *
 * Ce contrôle rejoue donc le parcours d'achat complet dans WebKit, sur les dimensions d'un iPhone,
 * puis vérifie les quatre balises dont iOS se sert pour installer l'application.
 *
 *   npm run build --workspace @savora/client && npm run servir
 *   node scripts/verifier-iphone.mjs
 */
import { webkit, devices } from 'playwright';

const CLIENT = process.env.CLIENT_URL ?? 'http://127.0.0.1:4173';

const reussies = [];
const echecs = [];

function v(libelle, passe, detail = '') {
  (passe ? reussies : echecs).push(libelle);
  console.log(`  ${passe ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` — ${detail}` : ''}`);
}

/** « Visible » ne veut pas dire « atteignable » : on interroge le point exact du doigt. */
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

const navigateur = await webkit.launch();
const iphone = await navigateur.newContext({ ...devices['iPhone 13'] });
const page = await iphone.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));

try {
  console.log(`\n── Safari sur iPhone 13 (${devices['iPhone 13'].viewport.width} px) ──`);

  await page.goto(`${CLIENT}/menu`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const carte = page.locator('a[href^="/produit/"], .product-card').first();
  v('Le menu se charge dans WebKit', (await carte.count()) > 0);

  // iOS est le champion du débordement horizontal : la page glisse sous le doigt à chaque geste.
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  v('Aucun débordement horizontal sur le menu', debordement <= 1, `${debordement} px`);

  await carte.click();
  await page.waitForURL('**/produit/**', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const ajouter = page.getByRole('button', { name: /Ajouter au panier/i }).first();
  v('Le bouton « Ajouter au panier » répond au doigt', await atteignable(ajouter));
  await ajouter.click();
  await page.waitForTimeout(1000);

  await page.goto(`${CLIENT}/panier`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Le défaut qui a motivé tout l'audit : à revérifier ici, le calcul de mise en page diffère.
  const commander = page.getByRole('button', { name: /Commander/i }).first();
  v('Le bouton « Commander » répond au doigt dans Safari', await atteignable(commander));

  const debordementPanier = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  v('Aucun débordement horizontal sur le panier', debordementPanier <= 1, `${debordementPanier} px`);

  await commander.click();
  await page.waitForURL('**/commander', { timeout: 15000 });
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /récupérer/i }).first().click();
  await page.waitForTimeout(600);
  await page.locator('#name').fill('Fatou Sawadogo');
  await page.locator('#phone').fill('76 44 33 22');
  await page.getByRole('button', { name: /^Valider/i }).first().click();
  await page.waitForURL('**/commande/**', { timeout: 25000 });
  await page.waitForTimeout(2500);

  const suivi = await page.locator('body').innerText();
  const code = suivi.match(/\b[ACDEFGHJKMNPQRTUVWXYZ2346789]{5}\b/);
  v('Une commande aboutit depuis un iPhone', Boolean(code), code?.[0] ?? '');

  // ── Ce dont iOS se sert pour installer l'application ──
  console.log('\n── Installation sur l\'écran d\'accueil ──');
  const balises = await page.evaluate(() => {
    const contenu = (nom) => document.querySelector(`meta[name="${nom}"]`)?.content ?? null;
    return {
      capable: contenu('apple-mobile-web-app-capable'),
      barre: contenu('apple-mobile-web-app-status-bar-style'),
      titre: contenu('apple-mobile-web-app-title'),
      icone: document.querySelector('link[rel="apple-touch-icon"]')?.href ?? null,
      manifeste: document.querySelector('link[rel="manifest"]')?.href ?? null,
    };
  });

  v('Mode plein écran demandé à iOS', balises.capable === 'yes', String(balises.capable));
  // Sur une interface claire, « black-translucent » écrirait l'heure en blanc sur crème.
  v('Barre d\'état lisible sur fond clair', balises.barre === 'default', String(balises.barre));
  v('Nom court sous l\'icône', balises.titre === 'Savora', String(balises.titre));
  v('Icône d\'écran d\'accueil déclarée', Boolean(balises.icone));
  v('Manifeste déclaré', Boolean(balises.manifeste));

  const icone = await page.request.get(balises.icone);
  v('L\'icône est réellement servie', icone.ok(), `HTTP ${icone.status()}`);

  // iOS sait faire les service workers depuis la 11.3 : la consultation hors ligne en dépend.
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'absent du navigateur';
    const enregistrement = await navigator.serviceWorker.getRegistration();
    return enregistrement ? 'actif' : 'non enregistré';
  });
  v('Service worker actif dans WebKit', sw === 'actif', sw);

  v('Aucune erreur JavaScript pendant tout le parcours', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
} finally {
  await navigateur.close();
}

console.log(`\n═════ ${reussies.length} passées, ${echecs.length} en échec ═════`);
echecs.forEach((e) => console.log('  ✗', e));
process.exit(echecs.length ? 1 : 0);

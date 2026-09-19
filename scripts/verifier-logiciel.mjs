/**
 * Vérifie l'application Windows — celle qu'un restaurateur installe et lance.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Ce script existe parce que l'exe livré affichait une page blanche.           │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'interface avait été vérifiée écran par écran dans un navigateur, et elle était juste. Mais
 * l'application Windows ne charge pas l'interface comme un navigateur : elle l'ouvrait comme un
 * fichier, sur une origine `file://`, et trois choses cassaient là — le routeur réécrivait l'adresse
 * du document vers un chemin inexistant, les appels d'API partaient en inter-origines sans en-tête
 * CORS, et le stockage de session devenait une zone commune.
 *
 * Aucun test d'interface ne pouvait le voir : ils tournent tous dans un navigateur, où rien de cela
 * ne se produit. Il fallait lancer l'application elle-même.
 *
 * Le contrôle va donc jusqu'au bout du parcours du restaurateur : première mise en route, saisie de
 * l'adresse, connexion réelle, et **rechargement** — le geste que tout le monde fait devant un écran
 * qui bloque, et celui qui produisait la page blanche.
 *
 *   npm run dev                 # l'API doit répondre
 *   npm run build:desktop
 *   node scripts/verifier-logiciel.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';
const MOT_DE_PASSE = process.env.DEMO_PASSWORD ?? 'savora2026';
const BUREAU = resolve('apps/desktop');
const ELECTRON = resolve(BUREAU, 'node_modules/.bin/electron');

if (!existsSync(resolve(BUREAU, 'web/index.html'))) {
  console.error('\n  ⚠  L\'interface n\'est pas préparée. Lancez : npm run build:desktop\n');
  process.exit(1);
}
if (!existsSync(ELECTRON)) {
  console.error('\n  ⚠  Electron absent. Lancez : npm install --prefix apps/desktop\n');
  process.exit(1);
}
try {
  const sante = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2500) });
  if (!sante.ok) throw new Error();
} catch {
  console.error(`\n  ⚠  L'API ne répond pas sur ${API}. Lancez « npm run dev ».\n`);
  process.exit(1);
}

/*
 * La sonde tourne **dans** l'application : c'est le seul endroit d'où l'on peut observer la fenêtre
 * telle que le restaurateur la voit. Elle charge le vrai `main.cjs`, sans le modifier.
 */
const sonde = resolve(tmpdir(), `savora-sonde-${process.pid}.cjs`);
writeFileSync(
  sonde,
  `const { app, BrowserWindow } = require('electron');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const lire = (f) => f.webContents.executeJavaScript('document.body.innerText.replace(/\\\\n+/g," | ")').catch((e) => 'ERREUR ' + e.message);
const dire = (cle, valeur) => console.log('SONDE ' + cle + ' ' + JSON.stringify(valeur));

app.on('ready', () => {
  setTimeout(async () => {
    try {
      const f = BrowserWindow.getAllWindows()[0];
      dire('depart', f.webContents.getURL().split('/').pop());

      const pose = await f.webContents.executeJavaScript("window.savora.definirServeur('127.0.0.1:4000')");
      dire('adresse', pose);
      await attendre(5000);

      dire('origine', new URL(f.webContents.getURL()).origin);
      dire('connexionVisible', /Connectez-vous/.test(await lire(f)));

      const mdp = process.env.SAVORA_DEMO_PASSWORD;
      const appel = await f.webContents.executeJavaScript(\`
        fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone: '70000002', password: \${JSON.stringify(mdp)} }),
        })
          .then(async (r) => ({ statut: r.status, role: (await r.json()).user?.role ?? null }))
          .catch((e) => ({ erreur: String(e) }))
      \`);
      dire('api', appel);

      await f.webContents.executeJavaScript(\`(() => {
        const poser = (el, v) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const i = document.querySelectorAll('input');
        poser(i[0], '70000002');
        poser(i[1], \${JSON.stringify(mdp)});
        [...document.querySelectorAll('button')].find((b) => /connexion|connecter/i.test(b.textContent)).click();
        return true;
      })()\`);
      await attendre(6000);
      dire('apresConnexion', await lire(f));

      f.webContents.reload();
      await attendre(6000);
      dire('apresRechargement', await lire(f));
    } catch (erreur) {
      dire('panne', String(erreur && erreur.message));
    }
    app.quit();
  }, 4000);
});

require(${JSON.stringify(resolve(BUREAU, 'main.cjs'))});
`,
  'utf8',
);

// Profil vierge : on vérifie une **première** mise en route, pas un état laissé par un essai passé.
for (const profil of ['Savora Pro', 'Electron', '@savora/desktop']) {
  rmSync(resolve(process.env.HOME ?? '/root', '.config', profil), { recursive: true, force: true });
}

const sorties = new Map();

/*
 * Electron a besoin d'un affichage. Sur un serveur d'intégration il n'y en a pas, et l'application
 * se termine alors sans un mot — ce qui ressemble à s'y méprendre à un test qui échoue. On passe donc
 * par un affichage virtuel quand aucun n'est présent, et on le dit si l'outil manque.
 */
const sansAffichage = !process.env.DISPLAY && process.platform === 'linux';
if (sansAffichage && !existsSync('/usr/bin/xvfb-run')) {
  console.error('\n  ⚠  Aucun affichage disponible et xvfb-run est absent.');
  console.error('     sudo apt install xvfb, ou lancez ce contrôle sur une machine avec écran.\n');
  process.exit(1);
}

const commande = sansAffichage ? 'xvfb-run' : ELECTRON;
const arguments_ = sansAffichage
  ? ['-a', ELECTRON, '--no-sandbox', '--disable-gpu', sonde]
  : ['--no-sandbox', '--disable-gpu', sonde];

const enfant = spawn(commande, arguments_, {
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1', SAVORA_DEMO_PASSWORD: MOT_DE_PASSE },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let tampon = '';
const traiter = (morceau) => {
  tampon += morceau;
  const lignes = tampon.split('\n');
  tampon = lignes.pop() ?? '';
  for (const ligne of lignes) {
    const trouve = ligne.match(/^SONDE (\w+) (.*)$/);
    if (trouve) {
      try {
        sorties.set(trouve[1], JSON.parse(trouve[2]));
      } catch {
        sorties.set(trouve[1], trouve[2]);
      }
    }
  }
};
const BAVARD = process.env.VERBEUX === '1';
enfant.stdout.on('data', (d) => { if (BAVARD) process.stdout.write(`[out] ${d}`); traiter(String(d)); });
enfant.stderr.on('data', (d) => { if (BAVARD) process.stdout.write(`[err] ${d}`); traiter(String(d)); });

await new Promise((resoudre) => {
  enfant.on('exit', resoudre);
  // Filet : si l'application se bloque, on ne veut pas attendre indéfiniment.
  setTimeout(() => {
    enfant.kill();
    resoudre(0);
  }, 90_000);
});
rmSync(sonde, { force: true });

// ── Verdict ──

const reussies = [];
const echecs = [];
function v(libelle, passe, detail = '') {
  (passe ? reussies : echecs).push(libelle);
  console.log(`  ${passe ? 'OK   ' : 'ÉCHEC'} ${libelle}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n── L\'application Windows, du premier lancement au rechargement ──');

if (sorties.has('panne')) {
  console.log(`  ÉCHEC La sonde s'est interrompue — ${sorties.get('panne')}`);
  echecs.push('sonde interrompue');
}

v('Le premier lancement demande l\'adresse du serveur', sorties.get('depart') === 'serveur.html', String(sorties.get('depart')));

const adresse = sorties.get('adresse');
v('L\'adresse est acceptée', Boolean(adresse?.ok), JSON.stringify(adresse));
// Un serveur d'arrière-boutique n'a pas de certificat : forcer https l'aurait rendu injoignable.
v('Une adresse locale part en http, pas en https', adresse?.serveur?.startsWith('http://') === true, String(adresse?.serveur));

const origine = String(sorties.get('origine') ?? '');
// LE point qui décide de tout : une vraie origine, pas `file://`.
v('L\'interface est servie sur une origine http', origine.startsWith('http://127.0.0.1:'), origine);

v('L\'écran de connexion s\'affiche', sorties.get('connexionVisible') === true);

const api = sorties.get('api');
v('Un appel d\'API aboutit à travers le relais', api?.statut === 200, JSON.stringify(api));
v('Le serveur reconnaît bien le rôle', api?.role === 'MANAGER', String(api?.role));

const apres = String(sorties.get('apresConnexion') ?? '');
v('La connexion ouvre le logiciel', /Tableau de bord/.test(apres) && !/Connectez-vous/.test(apres), apres.slice(0, 60));

const recharge = String(sorties.get('apresRechargement') ?? '');
// Le défaut d'origine : ici, la fenêtre devenait blanche.
v('Un rechargement ne vide pas la fenêtre', recharge.trim().length > 0 && /Tableau de bord|Connectez-vous/.test(recharge), recharge.slice(0, 60) || '(vide)');

console.log(`\n═════ ${reussies.length} passées, ${echecs.length} en échec ═════`);
echecs.forEach((e) => console.log('  ✗', e));
process.exit(echecs.length ? 1 : 0);

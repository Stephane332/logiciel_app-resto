/**
 * Savora Pro — application Windows.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un seul exe pour tous les restaurants. L'adresse du serveur est une donnée. │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'interface embarquée est exactement celle du navigateur : même code, même écrans, aucune
 * divergence possible. Ce que l'application ajoute, c'est ce qu'un navigateur ne sait pas faire
 * dans une salle de restaurant :
 *
 *   — un raccourci sur le bureau et un lancement en plein écran, sans barre d'adresse à côté de
 *     laquelle un employé pourrait partir ailleurs en plein service ;
 *   — l'adresse du serveur demandée une fois, puis retenue ;
 *   — le blocage de toute navigation hors du logiciel.
 *
 * L'interface est empaquetée dans l'exe plutôt que chargée depuis le serveur : si le serveur est
 * momentanément injoignable, la fenêtre s'ouvre quand même et affiche l'écran d'erreur du logiciel,
 * qui explique ce qui se passe. Chargée à distance, elle afficherait la page d'erreur du navigateur
 * — celle qui ne dit rien à personne.
 */
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { networkInterfaces } = require('node:os');
const { demarrer } = require('./serveur-local.cjs');
const baseEmbarquee = require('./base-embarquee.cjs');
const apiEmbarquee = require('./api-embarquee.cjs');
const { sauvegarder } = require('./sauvegarde.cjs');

/** Réglages, à côté des données de l'application : ils survivent à une mise à jour. */
const configFile = path.join(app.getPath('userData'), 'serveur.json');

function lireReglages() {
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch {
    // Premier lancement, ou fichier abîmé : on redemande plutôt que de partir sur une valeur fausse.
    return {};
  }
}

function lireServeur() {
  const valeur = lireReglages().serveur;
  return typeof valeur === 'string' && valeur ? valeur : null;
}

/**
 * Ce poste est-il la caisse principale — celle qui porte la base et l'API ?
 *
 * Le rôle est enregistré au premier lancement et ne change plus tout seul. C'est lui qui décide si le
 * logiciel démarre son propre serveur ou s'il va en chercher un sur le réseau.
 */
function estCaissePrincipale() {
  return lireReglages().role === 'serveur';
}

function ecrireReglages(valeurs) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify({ ...lireReglages(), ...valeurs }, null, 2), 'utf8');
}

function ecrireServeur(serveur) {
  ecrireReglages({ serveur, role: 'client' });
}

/**
 * Normalise ce que l'utilisateur a tapé.
 *
 * Un restaurateur écrit « monresto.bf », pas « https://monresto.bf ». Refuser sa saisie sur un
 * détail de protocole serait un mauvais accueil pour la première chose que le logiciel lui demande.
 */
function normaliserServeur(saisie) {
  const texte = String(saisie || '').trim();
  if (!texte) return null;

  /*
   * Le protocole, quand il n'est pas écrit.
   *
   * `https://` était ajouté systématiquement. C'est juste pour un domaine — mais faux pour un
   * serveur posé dans l'arrière-boutique, à une adresse comme « 192.168.1.20:4000 » : celui-là n'a
   * pas de certificat, et ne peut pas en avoir. Le logiciel refusait donc de se connecter au seul
   * montage qui ne coûte rien au restaurateur.
   *
   * Une adresse IP ou un nom de machine local part donc en `http://`, un nom de domaine en
   * `https://`. Ce que l'utilisateur écrit lui-même l'emporte toujours.
   */
  let avecProtocole;
  if (/^https?:\/\//i.test(texte)) {
    avecProtocole = texte;
  } else {
    const hote = texte.split('/')[0].split(':')[0];
    const local =
      /^\d{1,3}(\.\d{1,3}){3}$/.test(hote) ||
      hote === 'localhost' ||
      hote.endsWith('.local') ||
      !hote.includes('.');
    avecProtocole = `${local ? 'http' : 'https'}://${texte}`;
  }
  try {
    const url = new URL(avecProtocole);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

let fenetre = null;
/** Le serveur local qui sert l'interface et relaie le serveur du restaurant. */
let local = null;
/** Sur une caisse principale : la base et l'API de ce restaurant, portées par ce poste. */
let baseLocale = null;
let apiLocale = null;

/**
 * Ouvre l'interface.
 *
 * Elle n'est plus chargée comme un fichier mais servie par le serveur local, sur une véritable
 * origine `http://127.0.0.1:port`. Ce détail décide de tout : c'est ce qui rend le routeur, les
 * appels d'API et le stockage de session possibles (voir `serveur-local.cjs`).
 */
function ouvrirLogiciel(serveur) {
  if (!local) {
    // Sans serveur local, rien ne peut fonctionner : le dire plutôt que d'ouvrir une fenêtre vide.
    void afficherPanne('Le composant interne du logiciel n\'a pas démarré.');
    return;
  }
  local.definirAmont(serveur);
  fenetre.loadURL(`${local.origine}/`);
}

function afficherPanne(message) {
  return fenetre.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      `<!doctype html><html lang="fr"><body style="font-family:system-ui;padding:40px;background:#fbf8f3;color:#1a1510">
       <h1 style="font-size:20px">Savora Pro ne peut pas démarrer</h1><p>${message}</p>
       <p style="color:#6b6257">Fermez le logiciel et relancez-le. Si cela se reproduit, prévenez votre installateur.</p>
       </body></html>`,
    )}`,
  );
}

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#fbf8f3',
    // La fenêtre ne s'affiche qu'une fois prête : sans cela, un rectangle blanc clignote au
    // lancement, ce qui donne l'impression d'un logiciel qui rame avant même d'avoir démarré.
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  fenetre.once('ready-to-show', () => fenetre.show());

  // Un lien externe s'ouvre dans le navigateur, jamais dans la fenêtre du logiciel : une caisse
  // qui part sur un site quelconque est une caisse hors service.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Caisse principale : on remonte son propre serveur avant d'ouvrir l'interface.
  if (estCaissePrincipale()) {
    void demarrerServeurDuResto();
    return;
  }

  const serveur = lireServeur();
  if (serveur) ouvrirLogiciel(serveur);
  else fenetre.loadFile(path.join(__dirname, 'serveur.html'));
}

/**
 * Où les sauvegardes sont déposées.
 *
 * Dans les **Documents**, pas dans un répertoire d'application : c'est là que quelqu'un pense à
 * regarder, et là qu'il saura copier le dossier sur une clé USB. Une sauvegarde qu'on ne retrouve
 * pas le jour de la panne n'a jamais existé.
 */
function dossierDesSauvegardes() {
  return path.join(app.getPath('documents'), 'Savora', 'sauvegardes');
}

/** Ce que le restaurateur voit pendant que son serveur démarre. */
function annoncer(message) {
  fenetre?.webContents.send('savora:avancement', message);
}

/**
 * Les adresses par lesquelles ce PC est joignable depuis le réseau du restaurant.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Le logiciel savait son adresse et ne la disait à personne.                   │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le restaurateur installait la caisse principale, tout démarrait — et rien ne lui indiquait quoi
 * saisir sur la tablette de cuisine ou sur le téléphone du livreur. Il fallait ouvrir une invite de
 * commandes et lancer `ipconfig` : la seule étape de toute l'installation qui demandait de savoir
 * ce qu'est une adresse IP. C'est exactement là que s'arrête une vente.
 *
 * Plusieurs cartes existent souvent — Wi-Fi et Ethernet, parfois une carte virtuelle. On les donne
 * toutes plutôt que d'en choisir une au hasard : celle qui marche est celle du même réseau que les
 * téléphones, et seul le restaurateur peut le savoir. Les adresses de liaison locale (169.254.x.x)
 * sont écartées : elles signalent une carte sans réseau, jamais une adresse joignable.
 */
function adressesReseau(port) {
  const adresses = [];
  for (const [nom, cartes] of Object.entries(networkInterfaces())) {
    for (const carte of cartes ?? []) {
      if (carte.family !== 'IPv4' || carte.internal) continue;
      if (carte.address.startsWith('169.254.')) continue;
      adresses.push({ carte: nom, adresse: `${carte.address}:${port}` });
    }
  }
  return adresses;
}

/**
 * Démarre la base et l'API sur ce poste, puis ouvre l'interface dessus.
 *
 * L'ordre n'est pas négociable et le banc d'essai l'a montré : la base, le schéma, l'amorçage, puis
 * le serveur. L'amorçage lancé avant le schéma échoue sur « la table restaurants n'existe pas ».
 *
 * `infos` n'est fourni qu'à la première installation ; aux démarrages suivants, l'amorçage constate
 * que le restaurant existe et ne touche à rien.
 */
async function demarrerServeurDuResto(infos) {
  const donnees = app.getPath('userData');

  try {
    annoncer('Démarrage de la base de données…');
    baseLocale = await baseEmbarquee.demarrer({ racineDonnees: donnees, journal: () => {} });

    await apiEmbarquee.appliquerSchema({
      racineDonnees: donnees,
      urlBase: baseLocale.url,
      journal: annoncer,
    });

    const amorce = await apiEmbarquee.amorcer({
      racineDonnees: donnees,
      urlBase: baseLocale.url,
      nomRestaurant: infos?.nom,
      telephone: infos?.telephone,
      motDePasse: infos?.motDePasse,
      journal: annoncer,
    });

    apiLocale = await apiEmbarquee.demarrer({
      racineDonnees: donnees,
      urlBase: baseLocale.url,
      journal: () => {},
    });

    // Le rôle n'est enregistré qu'une fois que tout a démarré : un échec en cours de route ne doit
    // pas laisser le poste marqué « caisse principale » avec un serveur qui ne monte pas.
    ecrireReglages({ role: 'serveur', serveur: null });

    /*
     * La sauvegarde, avant d'annoncer que tout est prêt.
     *
     * Elle tourne à chaque démarrage, au plus une fois par jour, et ne peut pas empêcher le
     * service : un échec est signalé et noté, jamais bloquant. Une caisse qui refuserait de
     * s'ouvrir un midi parce qu'une copie a raté serait un remède pire que le mal.
     *
     * Elle est faite **après** le démarrage du serveur : à ce moment la base est debout et le
     * schéma est à jour, donc la copie est cohérente.
     */
    try {
      const bilan = sauvegarder({
        dossierSauvegardes: dossierDesSauvegardes(),
        binaires: baseEmbarquee.trouverBinaires(),
        urlBase: baseLocale.url,
        dossierPhotos: path.join(donnees, 'photos'),
        journal: annoncer,
      });
      if (!bilan.fait && bilan.raison === 'echec') {
        console.error('[savora] sauvegarde impossible :', bilan.detail);
        annoncer('Sauvegarde impossible — le service continue.');
      }
    } catch (erreur) {
      console.error('[savora] sauvegarde impossible :', erreur.message);
    }

    annoncer(amorce.deja ? 'Serveur prêt.' : 'Restaurant créé. Serveur prêt.');

    /*
     * On n'ouvre plus le logiciel tout de suite.
     *
     * L'écran suivant donne l'adresse à saisir sur les tablettes et les téléphones de l'équipe.
     * Ouvrir directement la caisse la ferait disparaître avant d'avoir été lue — et le
     * restaurateur se retrouverait devant `ipconfig`, ou devant rien du tout.
     *
     * Aux démarrages suivants, cet écran ne revient pas : la question ne se pose qu'une fois.
     */
    return { ok: true, adresses: adressesReseau(apiLocale.port), sauvegardes: dossierDesSauvegardes() };
  } catch (erreur) {
    // On redescend proprement : une base laissée en marche empêcherait la prochaine tentative.
    await apiLocale?.arreter().catch(() => {});
    await baseLocale?.arreter().catch(() => {});
    apiLocale = null;
    baseLocale = null;
    annoncer(`Échec : ${erreur.message}`);
    return { ok: false, message: erreur.message };
  }
}

/** Ouvre la caisse, une fois l'adresse notée par le restaurateur. */
ipcMain.handle('savora:ouvrir-logiciel', () => {
  if (apiLocale) ouvrirLogiciel(apiLocale.origine);
  return { ok: Boolean(apiLocale) };
});

ipcMain.handle('savora:serveur', () => lireServeur());

ipcMain.handle('savora:definir-serveur', (_evenement, saisie) => {
  const serveur = normaliserServeur(saisie);
  if (!serveur) return { ok: false, message: "Adresse invalide. Exemple : resto.mondomaine.bf" };
  ecrireServeur(serveur);
  ouvrirLogiciel(serveur);
  return { ok: true, serveur };
});

ipcMain.handle('savora:installer-serveur', async (_evenement, infos) => {
  const nom = String(infos?.nom ?? '').trim();
  if (!nom) return { ok: false, message: 'Indiquez le nom du restaurant.' };
  if (String(infos?.motDePasse ?? '').length < 8) {
    return { ok: false, message: 'Le mot de passe doit faire au moins 8 caractères.' };
  }
  return demarrerServeurDuResto({
    nom,
    telephone: String(infos?.telephone ?? '').trim(),
    motDePasse: String(infos?.motDePasse ?? ''),
  });
});

/** Permet de rebrancher le logiciel sur un autre serveur sans réinstaller. */
/**
 * Repartir de la première question.
 *
 * Les réglages sont effacés, pas seulement l'écran : sans cela, le prochain démarrage repartirait
 * sur l'ancienne adresse et le rôle enregistré, et le retour en arrière ne durerait que le temps
 * d'une fenêtre.
 *
 * Les **données** ne sont pas touchées — ni la base, ni les photos. Un restaurateur qui corrige
 * l'adresse de sa caisse ne doit pas y perdre ses commandes, et choisir de nouveau « caisse
 * principale » retrouve le restaurant existant : l'amorçage constate qu'il est déjà configuré.
 */
ipcMain.handle('savora:changer-serveur', () => {
  ecrireReglages({ role: null, serveur: null });
  fenetre.loadFile(path.join(__dirname, 'serveur.html'));
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Le serveur local démarre avant la fenêtre : celle-ci a besoin de son adresse pour s'ouvrir.
  try {
    local = await demarrer({ racine: path.join(__dirname, 'web') });
  } catch (erreur) {
    local = null;
    console.error('[savora] serveur local non démarré :', erreur.message);
  }

  creerFenetre();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

/*
 * Arrêt propre, dans l'ordre inverse du démarrage.
 *
 * Une base tuée brutalement rejoue son journal au démarrage suivant — quelques secondes de plus à
 * chaque ouverture, et un risque de perte sur la dernière transaction. Sur une caisse, c'est la
 * commande en cours.
 */
app.on('before-quit', async (evenement) => {
  if (!apiLocale && !baseLocale) return;
  evenement.preventDefault();
  await apiLocale?.arreter().catch(() => {});
  await baseLocale?.arreter().catch(() => {});
  apiLocale = null;
  baseLocale = null;
  app.quit();
});

app.on('will-quit', () => {
  local?.arreter();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

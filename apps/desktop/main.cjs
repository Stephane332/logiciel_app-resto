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

/** Réglages, à côté des données de l'application : ils survivent à une mise à jour. */
const configFile = path.join(app.getPath('userData'), 'serveur.json');

function lireServeur() {
  try {
    const brut = fs.readFileSync(configFile, 'utf8');
    const valeur = JSON.parse(brut).serveur;
    return typeof valeur === 'string' && valeur ? valeur : null;
  } catch {
    // Premier lancement, ou fichier abîmé : on redemande plutôt que de partir sur une valeur fausse.
    return null;
  }
}

function ecrireServeur(serveur) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify({ serveur }, null, 2), 'utf8');
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
  const avecProtocole = /^https?:\/\//i.test(texte) ? texte : `https://${texte}`;
  try {
    const url = new URL(avecProtocole);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

let fenetre = null;

function ouvrirLogiciel(serveur) {
  fenetre.webContents.session.setPreloads([path.join(__dirname, 'preload.cjs')]);
  process.env.SAVORA_SERVER = serveur;
  fenetre.loadFile(path.join(__dirname, 'web', 'index.html'));
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

  const serveur = lireServeur();
  if (serveur) ouvrirLogiciel(serveur);
  else fenetre.loadFile(path.join(__dirname, 'serveur.html'));
}

ipcMain.handle('savora:serveur', () => lireServeur());

ipcMain.handle('savora:definir-serveur', (_evenement, saisie) => {
  const serveur = normaliserServeur(saisie);
  if (!serveur) return { ok: false, message: "Adresse invalide. Exemple : resto.mondomaine.bf" };
  ecrireServeur(serveur);
  ouvrirLogiciel(serveur);
  return { ok: true, serveur };
});

/** Permet de rebrancher le logiciel sur un autre serveur sans réinstaller. */
ipcMain.handle('savora:changer-serveur', () => {
  fenetre.loadFile(path.join(__dirname, 'serveur.html'));
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  creerFenetre();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

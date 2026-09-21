/**
 * Pont entre l'application Windows et l'interface web.
 *
 * `contextIsolation` est actif et `nodeIntegration` désactivé : la page n'a donc aucun accès au
 * système. Elle ne reçoit que ce qui est exposé ici : trois fonctions, et rien d'autre.
 * Une page qui pourrait lire le disque du poste de caisse serait une porte ouverte pour
 * la première publicité malveillante croisée par un employé.
 */
const { contextBridge, ipcRenderer } = require('electron');

/*
 * L'adresse du serveur n'est plus transmise à l'interface, et c'est volontaire.
 *
 * Elle l'était par `__SAVORA_SERVER__`, et l'interface en faisait des URL absolues — donc des appels
 * entre origines, que le serveur refusait faute d'en-tête CORS pour une page `file://`. Désormais
 * l'interface est servie par le serveur local, qui relaie lui-même `/api` et `/realtime` : une
 * adresse relative suffit, et il n'y a plus d'origine étrangère du tout.
 *
 * C'est une chose de moins à injecter, une de moins à désynchroniser.
 */
contextBridge.exposeInMainWorld('savora', {
  serveur: () => ipcRenderer.invoke('savora:serveur'),
  definirServeur: (adresse) => ipcRenderer.invoke('savora:definir-serveur', adresse),
  changerServeur: () => ipcRenderer.invoke('savora:changer-serveur'),

  /** Installe la base et l'API sur ce PC : il devient la caisse principale du restaurant. */
  installerServeur: (infos) => ipcRenderer.invoke('savora:installer-serveur', infos),

  /** Ouvre la caisse, après que le restaurateur a noté l'adresse à donner à son équipe. */
  ouvrirLogiciel: () => ipcRenderer.invoke('savora:ouvrir-logiciel'),

  /**
   * Suit l'avancement de l'installation.
   *
   * Elle prend quelques secondes — création de la base, schéma, démarrage — et sans retour à
   * l'écran, le restaurateur croit que rien ne se passe et clique une deuxième fois.
   */
  surAvancement: (rappel) => {
    ipcRenderer.on('savora:avancement', (_evenement, message) => rappel(message));
  },
});

/**
 * Pont entre l'application Windows et l'interface web.
 *
 * `contextIsolation` est actif et `nodeIntegration` désactivé : la page n'a donc aucun accès au
 * système. Elle ne reçoit que ce qui est exposé ici, nommément — l'adresse du serveur, et deux
 * fonctions. Une page qui pourrait lire le disque du poste de caisse serait une porte ouverte pour
 * la première publicité malveillante croisée par un employé.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__SAVORA_SERVER__', process.env.SAVORA_SERVER || '');

contextBridge.exposeInMainWorld('savora', {
  serveur: () => ipcRenderer.invoke('savora:serveur'),
  definirServeur: (adresse) => ipcRenderer.invoke('savora:definir-serveur', adresse),
  changerServeur: () => ipcRenderer.invoke('savora:changer-serveur'),
});

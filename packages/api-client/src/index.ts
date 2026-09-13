/**
 * Client d'API BaraBite.
 *
 * Un noyau HTTP unique, deux jeux de points d'entrée : `customerApi` pour l'application cliente,
 * `staffApi` pour le logiciel restaurant. Les types des réponses sont partagés, ce qui garantit que
 * les deux interfaces parlent exactement le même langage que le serveur.
 */
export * from './http.js';
export * from './types.js';
export { customerApi } from './customer.js';
export { staffApi } from './staff.js';

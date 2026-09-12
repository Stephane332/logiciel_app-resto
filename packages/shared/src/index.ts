/**
 * Règles métier partagées par le backend, l'application cliente, le logiciel restaurant et la page
 * livreur.
 *
 * Ce paquet ne contient que des **fonctions pures** : aucun accès réseau, aucune base de données,
 * aucun état global. C'est ce qui permet de le charger partout sans surprise — et de le tester
 * entièrement (ADR 002).
 */
export * from './enums.js';
export * from './money.js';
export * from './order-status.js';
export * from './pricing.js';
export * from './permissions.js';
export * from './loyalty.js';
export * from './codes.js';
export * from './phone.js';
export * from './hours.js';
export * from './schemas.js';

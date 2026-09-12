# 002 — TypeScript sur toute la plateforme

**Statut :** acceptée — Septembre 2026

## Contexte
Quatre interfaces (client, restaurant, livreur, API) manipulent les mêmes notions : statuts de commande,
calcul des totaux, permissions.

## Décision
TypeScript partout. Les règles métier sensibles vivent dans `packages/shared`, importé par tous.

## Justification
Une règle dupliquée est une règle qui divergera. Le cas le plus coûteux : un total affiché au client
différent du total facturé. En partageant la fonction de calcul, l'écart devient structurellement
impossible.

## Conséquences
- `packages/shared` ne contient **que des fonctions pures**, sans accès réseau ni base de données.
- Le serveur reste l'autorité : le client *prévoit*, le serveur *décide*. Partager le code ne dispense
  jamais de revalider côté serveur.

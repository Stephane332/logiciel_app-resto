# 004 — Marque et catalogue en base, jamais dans le code

**Statut :** acceptée — Septembre 2026

## Contexte
Le premier client est Innova Group, à Ouahigouya. Le restaurant doit pouvoir saisir lui-même ses produits,
ses prix et ses photos. Un second restaurant est envisageable.

## Décision
Nom, logo, couleurs, signature, catalogue, horaires, tables et zones de livraison sont des **données**.
Toutes les tables métier portent un `restaurant_id` dès la V1.

## Justification
Un menu codé en dur impose un développeur à chaque nouveau sandwich — le logiciel meurt le jour où son
auteur s'absente. En données, le restaurant est autonome, et habiller un deuxième établissement ne coûte
rien.

## Conséquences
- Un assistant de configuration initiale guide la première saisie.
- Le jeu de données livré est un **démarrage**, jamais une vérité.
- La plateforme devient revendable à d'autres restaurateurs sans dette technique.

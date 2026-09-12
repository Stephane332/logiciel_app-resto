# 005 — Le logiciel encaisse tous les canaux de commande

**Statut :** acceptée — Septembre 2026

## Contexte
Les cahiers des charges antérieurs ne traitaient que les commandes issues de l'application mobile. Or dans
un fast-food de Ouahigouya, l'essentiel des commandes se prend au comptoir, par téléphone ou par WhatsApp.

## Décision
Le logiciel restaurant comporte un **module caisse**. Toute commande, quelle que soit son origine, entre
dans la même file, avec le même menu et les mêmes statuts. `orders.channel` en conserve la provenance :
`APP`, `COUNTER`, `PHONE`, `QR_TABLE`.

## Justification
Sans cela : la cuisine conserve son carnet papier en parallèle, donc deux systèmes et des oublis ; le
chiffre d'affaires du tableau de bord est faux puisqu'il ignore le comptoir ; les statistiques deviennent
inexploitables, donc plus personne ne les consulte, donc le logiciel est abandonné.

## Conséquences
- La caisse doit permettre de saisir une commande en moins de trente secondes, debout.
- Une commande de caisse démarre directement en `PREPARING` : elle est acceptée par définition.
- Le tableau de bord devient enfin un reflet honnête de l'activité.

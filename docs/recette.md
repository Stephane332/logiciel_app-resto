# Plan de tests et rapport de recette

Le cahier des charges (§ 21) énonce dix-sept critères d'acceptation. Chacun est ici **un test
automatisé**, exécuté à chaque modification — pas une intention, pas une case cochée à la main.

```bash
npm test
```

> **125 tests, tous au vert** au dernier passage. L'intégration continue les rejoue sur chaque
> poussée, avec une base PostgreSQL réelle.

---

## Couverture des critères d'acceptation

| # | Critère | Où il est vérifié |
|---|---|---|
| A1 | Une commande apparaît dans le logiciel restaurant en moins de 2 s | `realtime.test.ts` — mesuré à ~400 ms |
| A2 | Le restaurant peut accepter, préparer et terminer une commande | `order-status.test.ts`, `api.test.ts` |
| A3 | Le client reçoit chaque changement de statut | `realtime.test.ts` |
| A4 | Le total serveur est identique au total client, options comprises | `pricing.test.ts`, `api.test.ts` |
| A5 | Le numéro de table est conservé de bout en bout | `api.test.ts` |
| A6 | Une commande de retrait est identifiable par numéro et par code | `codes.test.ts`, `api.test.ts` |
| A7 | Un produit indisponible ou en rupture ne peut pas être commandé | `api.test.ts` |
| A8 | Une transition de statut interdite est rejetée | `order-status.test.ts`, `api.test.ts` |
| A9 | Un rôle `KITCHEN` ne peut pas modifier un prix | `permissions.test.ts`, `api.test.ts` |
| A10 | Un paiement n'est confirmé que par le serveur | `api.test.ts` (écart de total refusé) |
| A10b | Celui qui paie ne confirme jamais son propre paiement : la déclaration du client n'est jamais `CONFIRMED` | `api.test.ts`, `mobile-money.test.ts` |
| A18 | La commission n'est jamais facturée deux fois pour une même vente | `api.test.ts` |
| A19 | Une vente au comptoir n'est jamais commissionnée | `api.test.ts`, `commission.test.ts` |
| A20 | Le client ne voit jamais la commission | `api.test.ts` (route de suivi) |
| A21 | La commission reste hors de portée de la cuisine, de la caisse et du livreur | `api.test.ts`, `permissions.test.ts` |
| A22 | Aucun code USSD construit par le logiciel ne contient de code secret | `mobile-money.test.ts` |
| A23 | Une photo envoyée est décodée puis réencodée, et divisée par quatre au moins | `api.test.ts` |
| A24 | Un fichier qui n'est pas une image est refusé, quelle que soit son extension | `api.test.ts` |
| A25 | L'envoi de photos n'est pas ouvert à qui ne tient pas le menu | `api.test.ts` |
| A11 | Un jeton de table invalide ou expiré est refusé | `codes.test.ts`, `api.test.ts` |
| A12 | Hors horaires, la création de commande est refusée | `hours.test.ts`, `api.test.ts` |
| A13 | Aucun montant n'est représenté en flottant | `money.test.ts` |
| A14 | Le menu reste consultable sans réseau | vérifié au navigateur (voir plus bas) |
| A15 | Une commande de caisse compte dans le chiffre d'affaires du jour | `api.test.ts` |
| A16 | Les points de fidélité créditent le bon client au bon montant | `loyalty.test.ts`, `api.test.ts` |
| A17 | Un gérant crée une catégorie, un produit et une option sans intervention technique | `api.test.ts` |

---

## Au-delà des critères

Ces cas ne figuraient pas au cahier des charges. Ils ont été ajoutés parce qu'ils se produiront.

| Cas | Pourquoi | Test |
|---|---|---|
| Cinq commandes simultanées | Deux clients peuvent commander à la même seconde. Sans numérotation atomique, l'une échoue. | `api.test.ts` |
| Même numéro de téléphone, deux commandes simultanées | Un client qui tape deux fois sur « Valider ». | `api.test.ts` |
| Stock restitué après un refus | Sans cela, chaque refus fait disparaître des produits de l'inventaire. | `api.test.ts` |
| Prix figé à la commande | Changer un prix ne doit pas réécrire l'historique des ventes. | `api.test.ts` |
| Un client n'entre pas dans le flux du restaurant | Ce flux transporte les commandes de tous les clients. | `realtime.test.ts` |
| Un client n'accède pas à la vue de gestion du menu | Elle expose le stock et les produits désactivés. | `api.test.ts` |
| Réponse identique pour un numéro inconnu et un mot de passe faux | Distinguer les deux révélerait quels numéros sont inscrits. | `api.test.ts` |
| Un produit commandé est archivé, jamais effacé | Sinon l'historique perd son sens. | `api.test.ts` |
| Service franchissant minuit | Un fast-food qui ferme à 1 h du matin est la règle. | `hours.test.ts` |
| Codes de retrait sans caractères ambigus | Ils sont dictés au comptoir, dans le bruit. | `codes.test.ts` |

---

## Recette manuelle

Ce que l'automatisation ne couvre pas, et qui se vérifie dans un vrai navigateur, sur un vrai
téléphone.

### Application cliente

- [x] Commander en retrait **sans créer de compte** → code à cinq caractères obtenu
- [x] Option obligatoire non choisie → l'ajout au panier est bloqué, le champ fautif est désigné
- [x] Totaux : Double Cheese 3 500 F + supplément 500 F = 4 000 F, identiques côté serveur
- [x] Scanner un QR de table → menu ouvert, commande marquée `Table 08`
- [x] Jeton de table inventé → refusé avec un message clair
- [x] Réseau coupé → le menu reste consultable, un bandeau prévient
- [x] Aucun débordement horizontal à 360 px de large
- [ ] Installation depuis Chrome Android sur un téléphone réel
- [ ] Score Lighthouse PWA ≥ 90

### Logiciel restaurant

- [x] Caisse : commande au comptoir en quelques touches, envoyée en cuisine
- [x] Une commande de caisse démarre directement en préparation
- [x] Elle passe même restaurant fermé — l'employé présent fait foi
- [x] Cuisine → prête → remise → le chiffre d'affaires du jour se met à jour
- [x] Le rôle cuisine ne voit ni la caisse, ni les employés, ni les statistiques
- [x] Accès direct à `/employes` par URL → renvoyé vers l'accueil
- [ ] Alerte sonore sur un poste réel, en conditions de bruit
- [ ] Usage sur tablette tactile, en cuisine

### Avant l'ouverture au public

- [ ] Pilote avec le personnel, en conditions réelles, avant les premiers clients
- [ ] Commande passée depuis un téléphone d'entrée de gamme sur données mobiles
- [ ] Coupure de courant simulée pendant un service
- [ ] Restauration d'une sauvegarde vérifiée

---

## Limites connues

Trois points n'ont pas pu être vérifiés dans l'environnement de développement. Ils sont signalés
plutôt que passés sous silence.

| Limite | Conséquence | Quand ce sera levé |
|---|---|---|
| La construction Gradle de l'APK n'a jamais été exécutée | Le workflow Android n'est pas prouvé | Au premier lancement du workflow |
| Les images de production n'ont pas été construites | Docker était indisponible ici | Au premier déploiement |

Aucune de ces limites n'affecte les règles métier, qui sont, elles, entièrement testées.

**Une limite en moins.** Ce document annonçait que le paiement en ligne resterait simulé faute
d'agrégateur. Ce n'est plus vrai : Orange Money et Moov Money fonctionnent par code USSD, la preuve
étant faite par le restaurant sur le SMS reçu sur son propre téléphone
([ADR 008](adr/008-paiement-declare-atteste.md)). Il ne manque que les numéros marchands d'Innova Group.

## Recette du paiement Mobile Money *(vérifiée au navigateur)*

Parcours complet, client et restaurant en parallèle, sans rechargement côté client :

1. Commander en retrait, choisir Orange Money. **Moov Money ne doit pas apparaître** si son numéro
   marchand n'est pas renseigné — proposer un code USSD muet ferait payer dans le vide.
2. La validation mène à l'écran de paiement, pas au suivi : le client a son téléphone en main.
3. Le code est pré-rempli — `*144*10*<numéro marchand>*<montant>#` — et le montant correspond au total.
4. Le lien composable encode le `#` en `%23`, sans quoi le code serait tronqué.
5. Déclarer un identifiant de transaction. Le suivi doit annoncer **une vérification en cours**, jamais
   un paiement confirmé.
6. Côté restaurant, coller le SMS de l'opérateur : la commande est reconnue **par l'identifiant**.
7. Attester : la file se vide, et le client voit « Paiement confirmé » **en temps réel**, sans avoir
   rien touché — c'est la promesse faite à l'écran de paiement.

Les sept points passent.

## Recette de la commission *(vérifiée au navigateur)*

1. Passer une commande depuis l'application et la mener jusqu'à la remise.
2. Écran **Commission**, connecté en gérant : le taux s'affiche en clair, ainsi que l'encours.
3. Le détail montre la commande, son assiette, le taux et la commission — le calcul se refait à la
   main et doit tomber juste. Sur 3 500 F : **35 F**.
4. L'écran dit ce qui **n'est pas** facturé : comptoir, livraison, remises.
5. Connecté en caisse, l'entrée « Commission » n'apparaît pas.

Les sept vérifications passent.

# Cahier des charges — Plateforme BaraBite

> **Plateforme de commande et de gestion pour la restauration rapide**
> Premier client : **Innova Group** — Ouahigouya, Burkina Faso
>
> | | |
> |---|---|
> | **Concepteur** | Ange Stéphane Sawadogo |
> | **Version** | V3.0 — Septembre 2026 |
> | **Statut** | Document de référence actif |
> | **Remplace** | *Green Louie* V1.0 et *Cahier des charges complet* V2.0, archivés dans [`docs/archive/`](archive/) |

---

## 0. Ce que cette version change

Les deux cahiers des charges antérieurs ont été rédigés avant que le contexte réel du projet soit connu :
ils décrivent un fast-food générique à Ouagadougou, sans client identifié. Le projet sert en réalité
**Innova Group, à Ouahigouya**. Cette version réécrit donc le document sur trois plans : le contexte,
l'architecture produit, et la stratégie de diffusion.

### 0.1 Les trois changements structurels

| | Avant | **Maintenant** | Pourquoi |
|---|---|---|---|
| **Ville** | Ouagadougou, 2,4 M hab. | **Ouahigouya**, ~125 000 hab., 182 km au nord-ouest | Marché, logistique et réseau totalement différents (§ 1) |
| **Marque** | « à définir » / « Green Louie » | **Donnée de configuration**, par défaut *Innova Group* | Le logiciel doit pouvoir habiller un second restaurant sans une ligne de code (§ 2.7) |
| **Canaux de commande** | Application seule | **Application + comptoir + téléphone/WhatsApp**, une seule file | Sans cela, le logiciel ne voit qu'une fraction de l'activité (§ 2.1) |

**Nommage retenu :** *BaraBite* est le nom de la **plateforme logicielle** — le produit que construit et
pourra revendre le concepteur. *Innova Group* est la **marque affichée** au client final. Les deux ne se
confondent pas : le nom, le logo, les couleurs et le menu sont des données, pas du code.

### 0.2 Divergences arbitrées entre les deux anciens documents

| Sujet | V1.0 *Green Louie* | V2.0 *Complet* | **V3.0 — retenu** |
|---|---|---|---|
| Périmètre | mobile seul | mobile + restaurant + backend | **mobile + restaurant + backend** |
| Nom commercial | Green Louie | « à définir » | **configurable, défaut Innova Group** |
| Application livreur | V2 | V2 | **remplacée par une page livreur web en V1** (§ 2.5) |

### 0.3 Corrections techniques apportées

1. **Conflit de statut `PICKED_UP`.** Les deux documents employaient le même statut pour « le livreur a
   récupéré » et « le client a récupéré ». Un même mot pour deux réalités produit des erreurs de cuisine et
   des statistiques fausses. La livraison utilise désormais `ASSIGNED` (§ 14).
2. **Statuts terminaux manquants.** `REJECTED`, `CANCELLED`, `PAYMENT_FAILED`, `EXPIRED` n'existaient pas :
   une commande refusée n'avait nulle part où aller (§ 14).
3. **Rupture de stock en cours de commande** — cas non traité (§ 6.6).
4. **Annulation et remboursement** — cités dans « décisions à prendre », jamais spécifiés (§ 6.7).
5. **Frais de livraison** — « calcul des frais » sans modèle de calcul (§ 10).
6. **Politique de paiement par mode de commande** — non définie (§ 9.2).
7. **Comportement hors horaires** — non défini (§ 7.10).
8. **Mode dégradé réseau et électricité** — absent, alors qu'il conditionne l'exploitation réelle (§ 16).
9. **Sécurité des QR Codes** — « le backend vérifie le code » était trop vague pour être implémentable (§ 8).
10. **Protection des données personnelles** — les sauvegardes étaient traitées, pas le cadre légal (§ 15.4).
11. **Montants** — le FCFA n'a pas de sous-unité : entiers partout, jamais de flottants (§ 9.1).
12. **Cible matérielle et budget de performance** — absents (§ 18).
13. **Multi-restaurant** — classé P2, mais `restaurant_id` est introduit dès le premier schéma (§ 13).
14. **Numérotation des commandes** — format court, séquence quotidienne (§ 6.5).
15. **Critères d'acceptation** — réécrits en tests automatisés exécutables (§ 21).
16. **Rôles** — harmonisés entre les deux documents (§ 12).

---

## 1. Contexte réel

**Innova Group** exploite un fast-food à **Ouahigouya**, chef-lieu de la province du Yatenga, dans la
région du Nord — environ 125 000 habitants, à 182 km au nord-ouest de Ouagadougou. Le commerce est déjà
présent sur **TikTok et Facebook**.

Ce contexte n'est pas un décor : il dicte la conception.

| Réalité de Ouahigouya | Conséquence sur le produit |
|---|---|
| Ville moyenne : la clientèle est composée d'habitués, pas de flux anonyme | La fidélisation prime sur l'acquisition (§ 2.4) |
| Équipement smartphone et données mobiles coûteuses | Pas de store obligatoire, application légère, images optimisées (§ 18) |
| Audience déjà constituée sur TikTok et Facebook | Le menu doit être un **lien partageable**, c'est le canal d'acquisition n° 1 (§ 2.3) |
| WhatsApp et l'appel téléphonique sont les canaux de commande actuels | Ils doivent entrer dans le logiciel, pas lui rester extérieurs (§ 2.1) |
| Livraison assurée à moto par un ou deux employés | Une page web livreur suffit, une application native serait du gaspillage (§ 2.5) |
| Réseau et électricité irréguliers | Fonctionnement dégradé obligatoire, pas optionnel (§ 16) |
| Contexte sécuritaire régional variable | Zones de livraison et horaires modifiables **immédiatement**, sans développeur (§ 10) |

---

## 2. Refonte de l'approche

Les cahiers des charges antérieurs décrivaient une application de livraison inspirée des plateformes
internationales. Transposée telle quelle à Ouahigouya, elle échouerait — non par défaut technique, mais
parce qu'elle résout un problème que le restaurant n'a pas, tout en ignorant celui qu'il a. Sept
changements suivent.

### 2.1 Le logiciel doit encaisser **toutes** les commandes, pas seulement celles de l'application
**Le défaut majeur des specs précédentes.** Dans un fast-food de Ouahigouya, la grande majorité des
commandes se prennent au comptoir, par téléphone ou par WhatsApp. Un logiciel qui ne reçoit que les
commandes issues de l'application produit trois conséquences graves :

- la cuisine garde son carnet papier en parallèle — donc deux systèmes, donc des oublis ;
- le chiffre d'affaires affiché au tableau de bord est **faux**, puisqu'il ignore le comptoir ;
- les statistiques ne servent à rien, donc plus personne ne les regarde, donc le logiciel meurt.

**Décision :** le logiciel restaurant intègre un **module caisse** permettant à un employé de saisir une
commande au comptoir ou par téléphone en quelques secondes, avec le même menu, les mêmes options et les
mêmes statuts. L'application cliente devient **un canal parmi trois**, et non un univers parallèle.
C'est ce qui rend le tableau de bord vrai et la cuisine unique.

### 2.2 Ne pas exiger de compte pour commander
Imposer une inscription avant de voir le menu fait perdre la majorité des visiteurs. **Le menu est public
et consultable sans compte.** Un nom et un numéro de téléphone suffisent pour commander ; le compte se
crée silencieusement autour de ce numéro et le mot de passe devient optionnel. La vérification par OTP
sera activée quand le budget SMS le justifiera.

### 2.3 Le menu est un lien, et c'est la stratégie d'acquisition
Innova Group a déjà une audience sur TikTok et Facebook. Le produit doit en tirer parti au lieu de
construire une audience de zéro :

- chaque produit et chaque catégorie possède une **URL propre et partageable** ;
- chaque lien génère un **aperçu riche** (image, nom, prix) dans WhatsApp, Facebook et TikTok ;
- le lien en biographie mène au menu, qui mène à la commande, sans installation ;
- l'installation de l'application est **proposée**, jamais imposée.

C'est gratuit, immédiat, et cela exploite un actif que le restaurant possède déjà.

### 2.4 Fidélité dès la V1, pas en V2
Dans une ville de 125 000 habitants, le chiffre d'affaires vient des habitués. Les anciennes specs
classaient la fidélité en P2 ; la maquette, elle, l'affiche en évidence. **Décision : programme de points
simple dès la V1** — des points par franc dépensé, un produit offert à un palier. Peu coûteux à
construire, c'est le levier de rétention le plus direct du projet.

### 2.5 Une page livreur web plutôt qu'une application livreur
Les anciennes specs reportaient l'application livreur en V2, laissant la livraison sans outil en V1. Pour
un ou deux livreurs à moto, une **page web protégée par lien** suffit : tournée du jour, appel du client
en un geste, itinéraire, confirmation de remise. Aucune installation, aucun store, disponible en V1.

### 2.6 Le stock et l'impression sont des besoins de cuisine, pas des options
- **Compteurs de stock simples** : un produit tombe automatiquement en « indisponible » à zéro. Sans cela,
  le restaurant vend ce qu'il n'a plus et doit rembourser.
- **Ticket de cuisine imprimé** (imprimante thermique ESC/POS) : les cuisines travaillent au papier, pas à
  l'écran. Prévu dès l'architecture, activable selon le matériel.

### 2.7 La marque est une donnée, pas du code
Nom, logo, couleurs, signature, devise, menu, horaires et zones sont **stockés en base**. Conséquence :
habiller un deuxième restaurant ne demande aucune modification de code. Associé à la clé `restaurant_id`
présente dès la V1, cela transforme un logiciel sur mesure en **produit revendable** à d'autres
restaurateurs burkinabè — sans surcoût aujourd'hui.

### 2.8 Le restaurant renseigne lui-même son catalogue
Aucun menu n'est codé en dur. Le logiciel livré contient un **jeu de démarrage minimal**, et Innova Group
saisit ensuite ses propres catégories, produits, descriptions, photos, options, suppléments, prix, tables
et zones de livraison depuis le logiciel restaurant — sans développeur, sans redéploiement, sans ticket.

Un **assistant de configuration initiale** guide cette saisie au premier lancement : identité de la marque,
horaires, catégories, premiers produits, tables et QR Codes, zones de livraison, moyens de paiement
autorisés. Tant qu'une étape reste incomplète, le tableau de bord l'affiche comme un point à traiter.

C'est la condition pour que la plateforme vive sans son concepteur, et pour qu'elle puisse demain servir un
autre restaurant (§ 2.7).

---

---

## 3. Les trois parcours clients

### 3.1 Livraison
Produits → panier → *Livraison* → adresse (secteur + point de repère) → paiement → confirmation →
préparation → affectation au livreur → livraison.

### 3.2 Commander & récupérer — *parcours prioritaire*
Commande à l'avance → *Retrait* → délai estimé ou heure choisie → paiement → préparation → notification
« commande prête » → **code de retrait** → récupération au comptoir.

> Exemple : Commande **#254** — 21h15 — Code de retrait **G7K29**.

### 3.3 Manger sur place
Scan du QR Code de la table → la table est reconnue → commande → paiement selon la politique du
restaurant → préparation → service à la table.

> Exemple : Commande **#254** — **Table 08** — 6 000 F — En préparation.

### 3.4 Comptoir et téléphone *(nouveau — § 2.1)*
Un employé saisit la commande dans le module caisse : mêmes produits, mêmes options, même file de cuisine,
mêmes statistiques. C'est le canal le plus utilisé au lancement, et le logiciel doit l'assumer.

---

## 4. Architecture générale

```
  Application cliente        Logiciel restaurant        Page livreur
  (PWA + APK)                (caisse, cuisine, menu)    (web, par lien)
        │                            │                        │
        └────────────────────────────┼────────────────────────┘
                                     ▼
                    API / Backend sécurisé (règles métier)
                                     │
        ┌────────────────┬───────────┴────────┬──────────────────┐
        ▼                ▼                    ▼                  ▼
   PostgreSQL      Paiements            Temps réel         Notifications
                   Mobile Money         WebSocket          Push / in-app
```

**Règle d'or, non négociable :** aucune application n'accède directement à la base de données. Les
transitions de statut, le calcul des totaux, les permissions, la validation des QR Codes et la
confirmation des paiements vivent dans le backend et **uniquement** là. Les interfaces peuvent *prévoir*
un résultat pour rester réactives ; elles ne le *décident* jamais.

---

## 5. Choix technologiques retenus

| Brique | Technologie | Justification |
|---|---|---|
| Backend | Node.js, TypeScript, Fastify | Un seul langage sur toute la plateforme ; tient sur un VPS modeste |
| Base de données | PostgreSQL 16 + Prisma | Transactions fiables pour commandes et paiements ; migrations versionnées |
| Temps réel | Socket.IO | Reconnexion automatique et repli en interrogation — indispensable sur réseau instable |
| Application cliente | React + Vite + TypeScript, PWA | Installable sans store ; le QR de table devient une simple URL |
| APK Android | Capacitor + GitHub Actions | Même code source que la PWA ; APK compilé en intégration continue |
| Logiciel restaurant | React + Vite + TypeScript | Partage le design system et la couche de données avec le client |
| Règles partagées | `packages/shared` | Machine à états, prix et permissions écrits une seule fois |

> **Pourquoi pas Flutter ni React Native ?** Les deux restent valables pour du natif pur. Mais la PWA est
> le premier canal de diffusion : pas de store, mise à jour instantanée, et un QR de table qui ouvre le
> menu **sans installation**. Ajouter Dart ou React Native imposerait un second écosystème à maintenir
> sans bénéfice visible par le client. Les règles métier étant isolées dans `packages/shared`, un passage
> ultérieur au natif ne perdrait rien.

---

## 6. Application cliente — spécifications

### 6.1 Écrans
Splash, onboarding, connexion et inscription simplifiées, accueil, menu et catégories, recherche, détail
produit, personnalisation, panier, choix du mode, adresse, paiement, confirmation, suivi, commande prête
et code de retrait, table via QR, historique, détail d'une commande, favoris, fidélité, profil,
notifications, aide.

### 6.2 Accueil
Logo et localisation, recherche, catégories, menu du moment, produits populaires, solde de points de
fidélité, accès panier et commandes. Navigation basse à cinq onglets :
**Accueil · Menu · Panier · Commandes · Compte**.

### 6.3 Détail produit
Visuel, nom, description, prix, quantité, groupes d'options, suppléments payants, calcul du prix en
direct, ajout au panier. URL propre et aperçu riche partageable (§ 2.3).

### 6.4 Panier et commande
Modification et suppression des lignes, sous-total, frais de livraison, remise, total, choix du mode,
adresse, paiement, confirmation. **Le total affiché est toujours revalidé par le serveur avant paiement.**

### 6.5 Numérotation
Séquence quotidienne remise à zéro chaque jour, unique par restaurant et par jour, affichée `#254`. Le
numéro est court parce qu'il est lu à voix haute au comptoir.

### 6.6 Rupture de stock en cours de commande *(cas nouvellement spécifié)*
- **au panier** — la ligne est signalée et bloque la validation tant qu'elle n'est pas retirée ;
- **à la validation** — le serveur refuse et renvoie la liste précise des lignes fautives ;
- **après acceptation** — le restaurant refuse avec le motif `OUT_OF_STOCK` ; le client est notifié et
  remboursé si le paiement était confirmé.

### 6.7 Annulation et remboursement *(cas nouvellement spécifié)*
Annulation libre par le client tant que la commande est en `PENDING`. Après `ACCEPTED`, elle passe par le
restaurant, avec motif obligatoire. Remboursement **manuel et tracé** en V1 : toute opération laisse une
écriture `refunds` avec auteur, motif, montant et horodatage.

---

## 7. Logiciel restaurant — spécifications

### 7.1 Tableau de bord
Commandes du jour **tous canaux confondus**, chiffre d'affaires, commandes en préparation, commandes à
récupérer, état ouvert/fermé, ventes du jour, produits les plus vendus.

### 7.2 Caisse — commandes au comptoir et par téléphone *(nouveau — § 2.1)*
Saisie rapide : grille de produits, options, quantité, client optionnel (nom et téléphone), mode de
commande, encaissement espèces ou Mobile Money, envoi direct en cuisine, impression du ticket. Conçue pour
être utilisée **debout, sous la pression, en moins de trente secondes**.

### 7.3 Réception des commandes de l'application
Alerte sonore et visuelle, numéro, client, canal, type, heure souhaitée, produits et options, total et
état du paiement, **Accepter** / **Refuser** (motif obligatoire au refus).

### 7.4 Cuisine
File unique alimentée par les trois canaux, détail des produits et options, minuteur depuis l'acceptation,
priorité par heure promise, bouton **Marquer comme prête**, impression du ticket.

### 7.5 Retrait
Liste des commandes prêtes, recherche par numéro ou code, confirmation de remise contre le code.

### 7.6 Sur place
Plan des tables et leur état (libre, occupée, en préparation, à servir, servie), commande liée au QR Code,
passage au statut servi.

### 7.7 Livraison
Commandes à livrer, affectation à un livreur, lien de tournée, suivi des remises (§ 2.5).

### 7.8 Menu et stock
Création, modification, suppression de produits ; prix, description, image, catégorie ; groupes d'options
et suppléments ; **disponibilité basculable en un geste** ; compteurs de stock avec passage automatique en
indisponible à zéro ; ordre d'affichage.

### 7.9 Statistiques et administration
Chiffre d'affaires et commandes par période, évolution, répartition par canal et par mode, produits les
plus vendus, panier moyen, **heures de pointe** pour dimensionner les équipes. Employés et rôles, horaires,
promotions, fidélité, QR Codes des tables, identité de marque, paramètres.

### 7.10 Hors horaires *(cas nouvellement spécifié)*
Hors horaires, ou lorsque le gérant bascule en « fermé », la prise de commande est **bloquée côté
serveur** — pas seulement masquée dans l'interface. Le client voit les horaires et la prochaine ouverture.
La livraison possède son propre interrupteur, coupable indépendamment du reste (§ 1).

---

## 8. QR Codes et tables

Chaque table porte un QR Code encodant une URL `https://<domaine>/t/<jeton>`.

- Le **jeton est opaque et non devinable** (aléatoire, 22 caractères) — jamais le numéro de table, sinon
  n'importe qui commande sur n'importe quelle table depuis chez lui.
- Le scan ouvre une **session de table** à durée limitée (90 minutes par défaut), rattachée à l'appareil.
- Le backend vérifie le jeton, l'état actif de la table et l'ouverture du restaurant avant d'accepter la
  moindre commande.
- Un jeton est **régénérable** depuis le logiciel restaurant, ce qui invalide immédiatement l'ancien QR
  Code imprimé.

---

## 9. Paiement

### 9.1 Représentation des montants *(règle nouvellement spécifiée)*
Le franc CFA n'a pas de sous-unité en circulation courante. **Tous les montants sont des entiers de
FCFA** — en base, dans l'API et dans les interfaces. Aucun flottant, nulle part. Les remises produisant un
montant fractionnaire sont arrondies à l'entier inférieur ; les prix affichés le sont au multiple de 5 F
le plus proche.

### 9.2 Politique par mode *(nouvellement spécifiée)*

| Mode | Paiement en ligne | Paiement sur place | Défaut |
|---|---|---|---|
| Livraison | Mobile Money | Espèces à la livraison | en ligne ou espèces |
| Retrait | Mobile Money | Espèces au comptoir | en ligne exigé |
| Sur place | Mobile Money | Espèces / caisse | au choix du restaurant |
| Comptoir | — | Espèces / Mobile Money | espèces |

Chaque politique est un **paramètre du restaurant**, modifiable sans redéploiement.

### 9.3 Intégrations *(révisé — voir [ADR 008](adr/008-paiement-declare-atteste.md))*
Orange Money et Moov Money **par code USSD, sans agrégateur**, espèces si le restaurant l'autorise. Les
deux documents d'origine tenaient le Mobile Money pour suspendu à un contrat d'agrégateur : c'était une
erreur d'analyse, et elle repoussait le seul moyen de paiement réellement utilisé par la clientèle visée.

Un agrégateur n'apporte pas le paiement — il apporte sa **confirmation automatique**, et la facture. Le
paiement, lui, fonctionne déjà.

### 9.4 Règle de confirmation
Un paiement n'est **jamais** confirmé sur la foi de l'application cliente. C'est le seul endroit du
système où un mensonge rapporte de l'argent. La règle s'énonce ainsi :

> **Celui qui paie ne confirme jamais son propre paiement.**

Le parcours en trois temps :

1. **Composer.** Le serveur construit le code USSD déjà rempli — numéro marchand du restaurant et montant
   exact. Le client compose depuis un lien, ou recopie le code affiché.
2. **Déclarer.** Le client recopie l'identifiant de transaction reçu par SMS. Le paiement passe à
   `DECLARED` : une affirmation, pas une preuve. La commande n'avance pas, et l'écran le dit au client.
3. **Attester.** Un employé habilité (`payment:collect`) compare avec le SMS reçu sur **le téléphone du
   restaurant** — le logiciel y lit le montant et l'identifiant et désigne la commande — puis atteste.
   Le paiement devient alors `CONFIRMED`, avec son auteur, son horodatage et sa note.

Le rapprochement refuse de deviner : l'identifiant prime sur le montant, et si deux commandes portent la
même somme sans identifiant pour trancher, le logiciel le signale au lieu de choisir.

Le jour où un agrégateur est contractualisé, la confirmation par webhook signé puis vérification de la
transaction (ADR 007) se branche sans rien défaire.

### 9.5 État V1
**Mobile Money opérationnel** — Orange Money et Moov Money, dès que le restaurant a saisi ses numéros
marchands dans ses paramètres. Espèces opérationnelles. Un fournisseur simulé reste disponible pour le
développement et la démonstration. Un moyen de paiement n'est proposé au client que si son numéro
marchand est réellement renseigné.

### 9.6 Modèle économique : commission de la plateforme *(nouvellement spécifié)*

Aucun des deux documents d'origine n'abordait le financement du logiciel. C'est pourtant une décision
structurante, et elle touche au code : **1 % sur les ventes apportées par l'application**, pas
d'abonnement ([ADR 009](adr/009-commission-plateforme.md)).

**Accumulée, puis reversée — et non prélevée à la transaction.** Ce n'est pas un arbitrage de
confort : le client paie le restaurant directement, de son téléphone au numéro marchand (§ 9.4). Il
n'existe aucun intermédiaire dans le flux d'argent, donc rien à prélever au passage. La commission
est une dette enregistrée, réglée par transfert à l'échéance. S'y ajoutent trois raisons de fond :
une partie des ventes se règle en espèces, un transfert de 35 F coûte plus qu'il ne rapporte, et une
vente remboursée doit pouvoir se contre-passer.

| | Dans l'assiette |
|---|---|
| Commande passée depuis l'application ou par QR de table | **oui** |
| Vente au comptoir, commande par téléphone | non |
| Frais de livraison | non — ils vont au livreur |
| Remises commerciales et fidélité | non — argent jamais encaissé |

**Le comptoir n'est jamais facturé, délibérément.** Le jour où saisir une vente au comptoir coûte de
l'argent, l'équipe cesse de la saisir : le chiffre d'affaires devient faux, le stock dérive, et le
logiciel perd ce qui faisait sa valeur. On ne taxe pas quelqu'un qui saisit ses propres données.

**Tout est visible par le restaurant** — taux, assiette, détail commande par commande, et ce qui
n'est pas facturé. Une commission qu'on ne peut ni recouper ni contester détruit la relation à la
première fin de mois. **Le client, lui, ne voit jamais rien** : il paie le prix affiché.

---

## 10. Livraison

- Adresse composée d'un **secteur**, d'un quartier et d'un **point de repère** — Ouahigouya n'a pas
  d'adressage postal exploitable, et c'est ainsi que les gens se repèrent réellement.
- **Frais forfaitaires par zone** *(modèle nouvellement spécifié)* : chaque zone porte un forfait et un
  montant minimum. Pas de calcul kilométrique en V1 : sans adressage fiable, il produirait des frais faux.
- Zones **activables et désactivables en un clic** par le gérant, ainsi que la livraison dans son ensemble.
- Affectation manuelle à un livreur, qui dispose d'une page web de tournée (§ 2.5).

---

## 11. Notifications

Nouvelle commande côté restaurant ; acceptée ou refusée ; paiement confirmé ; en préparation ; prête ;
disponible au retrait ; départ en livraison ; récupérée, servie ou livrée ; points de fidélité gagnés ;
promotions.

Les notifications **promotionnelles** exigent un consentement distinct, révocable depuis le profil (§ 15.4).

---

## 12. Rôles et permissions

| Rôle | Accès |
|---|---|
| `CLIENT` | Commande, paiement, suivi, historique, fidélité, profil |
| `KITCHEN` | Commandes à préparer, passage au statut prête |
| `CASHIER` | Caisse, encaissement, remise au client |
| `DELIVERY` | Tournée du jour, confirmation de remise |
| `MANAGER` | Ce qui précède, plus menu, stock, horaires, promotions, statistiques |
| `ADMIN` | Accès complet, utilisateurs, marque et paramètres |

Les permissions sont **vérifiées côté serveur à chaque requête**. L'interface masque ce qui est interdit,
mais ce masquage n'est jamais le mécanisme de sécurité.

---

## 13. Base de données

| Table | Données principales |
|---|---|
| `restaurants` | nom, marque, contact, ouverture, politiques, fuseau |
| `users` | téléphone, nom, email, rôle, statut, consentements, points |
| `refresh_tokens` | jeton haché, appareil, expiration, révocation |
| `categories` | nom, ordre, statut |
| `products` | nom, description, prix, image, catégorie, disponibilité, stock, ordre |
| `option_groups` | produit, nom, choix minimum et maximum, obligatoire |
| `option_items` | groupe, nom, supplément, disponibilité |
| `orders` | numéro, client, **canal**, type, statut, totaux, table, adresse, code de retrait |
| `order_items` | commande, produit, quantité, prix unitaire figé, total |
| `order_item_options` | ligne, option, nom et prix figés |
| `order_events` | commande, statut, auteur, motif, horodatage |
| `payments` | commande, montant, méthode, statut, référence, données fournisseur |
| `refunds` | paiement, montant, motif, auteur |
| `addresses` | utilisateur, secteur, quartier, point de repère, coordonnées |
| `delivery_zones` | nom, forfait, commande minimum, actif |
| `tables` | numéro, jeton QR, statut, capacité |
| `table_sessions` | table, appareil, ouverture, expiration |
| `promotions` | code, type, valeur, période, conditions |
| `loyalty_transactions` | client, commande, points gagnés ou dépensés, motif |
| `opening_hours` | jour, ouverture, fermeture |
| `notifications` | destinataire, type, contenu, lu, horodatage |
| `audit_logs` | auteur, action, cible, données, horodatage |

Toutes les tables métier portent un `restaurant_id` dès la V1 : le multi-restaurant ne demandera aucune
migration de données.

**Prix figés à la commande.** `order_items` conserve le prix au moment de l'achat. Changer le prix d'un
produit ne doit jamais réécrire l'historique des ventes.

**Canal de commande.** `orders.channel` vaut `APP`, `COUNTER`, `PHONE` ou `QR_TABLE`. C'est ce champ qui
rend le tableau de bord honnête (§ 2.1).

---

## 14. Statuts des commandes

```
PENDING ──► ACCEPTED ──► PREPARING ──► READY ──┬─ (retrait)   ─► PICKED_UP ─► COMPLETED
   │            │            │                 ├─ (sur place) ─► SERVED    ─► COMPLETED
   │            │            │                 └─ (livraison) ─► ASSIGNED ─► OUT_FOR_DELIVERY ─► DELIVERED ─► COMPLETED
   │            │            │
   ├─► REJECTED (motif obligatoire)
   ├─► CANCELLED (client avant acceptation, ou restaurant avec motif)
   └─► PAYMENT_FAILED

READY (retrait) ──► EXPIRED   si la commande n'est jamais récupérée
```

- `PICKED_UP` signifie désormais **uniquement** « le client a récupéré sa commande ».
- `ASSIGNED` signifie « la commande est confiée à un livreur ». Cette distinction corrige l'ambiguïté des
  versions antérieures.
- Une commande saisie à la caisse peut démarrer directement en `PREPARING` : elle est déjà acceptée par
  définition.
- Toute transition est validée côté serveur, avec le rôle autorisé, et laisse une trace dans
  `order_events`. Une transition interdite est rejetée, jamais silencieusement ignorée.

---

## 15. Sécurité

### 15.1 Transport et authentification
HTTPS/TLS obligatoire. Identité fondée sur le **numéro de téléphone**, qui est l'identifiant réel au
Burkina Faso. Mots de passe hachés en argon2id lorsqu'ils existent. Jeton d'accès court, jeton de
rafraîchissement révocable. Vérification OTP prête, activable quand le budget SMS le permet.

### 15.2 Application
Aucune clé secrète dans l'application cliente. Validation systématique côté serveur. Limitation de débit
sur l'authentification, la création de commande et les webhooks. Protection contre les commandes
frauduleuses et le spam.

### 15.3 Traçabilité
Journalisation des opérations sensibles : paiements, remboursements, changements de prix, modifications de
rôles, régénération des QR Codes, ouverture de caisse. Sauvegardes quotidiennes chiffrées, restauration
testée.

### 15.4 Protection des données personnelles *(section nouvellement ajoutée)*
Le traitement de données personnelles au Burkina Faso relève de la **Commission de l'Informatique et des
Libertés (CIL)**. En conséquence :

- déclaration du traitement auprès de la CIL avant mise en production ;
- collecte limitée au nécessaire : téléphone, nom, adresses de livraison ;
- **conservation** : commandes 3 ans (obligations comptables), adresses jusqu'à suppression par le client,
  journaux techniques 12 mois ;
- droit d'accès, de rectification et de suppression accessible depuis le profil ;
- consentement **distinct et révocable** pour les notifications promotionnelles ;
- aucune revente ni partage à des tiers hors prestataires techniques.

---

## 16. Exploitation en conditions réelles

| Contrainte | Réponse du système |
|---|---|
| Coupures réseau | Menu consultable hors ligne ; file d'envoi locale ; reconnexion automatique |
| Coupures électriques | Aucun état critique en mémoire seule ; commande persistée avant accusé de réception |
| Données mobiles coûteuses | Images optimisées, budget de bundle, mise en cache agressive |
| Téléphones d'entrée de gamme | Android 8+, écrans 360 px, interface sobre en animations |
| Poste restaurant hors ligne | Bandeau visible en cuisine, rechargement automatique au retour du réseau |
| Contexte local variable | Livraison, zones et horaires modifiables instantanément par le gérant |

---

## 17. Identité et UI/UX

**Direction artistique — la maquette existante fait foi.** L'univers visuel proposé lors de la conception
(fond vert nuit, accents or, grandes cartes produits, navigation basse à cinq onglets) est **conservé**. Il
est affiné, non remplacé : contraste relevé pour la lecture en plein soleil, cibles tactiles agrandies,
échelle typographique régulière, états de chargement et d'erreur dessinés — c'est-à-dire tout ce qu'une
planche de maquettes ne montre jamais mais qu'une application réelle doit assumer.

- **Marque affichée :** configurable ; par défaut **Innova Group**, Ouahigouya.
- **Couleurs par défaut :** vert nuit profond (fond), or lumineux (action), blanc cassé (texte), vert vif
  (disponibilité), rouge (refus et alerte). Modifiables en base sans redéploiement.
- Interface moderne, sombre, très visuelle : les produits occupent l'espace, les prix en FCFA sont
  immédiatement lisibles, les boutons d'action sont larges et atteignables au pouce.
- Statuts de commande en langage clair, jamais en jargon technique.
- Logiciel restaurant responsive ordinateur et tablette, pensé pour un usage debout, en cuisine, à une
  main, parfois avec les doigts gras : cibles tactiles généreuses, contraste élevé, aucune action
  destructrice à portée de pouce égaré.

---

## 18. Budget de performance

| Indicateur | Cible |
|---|---|
| Premier affichage utile, 3G | < 3 s |
| JavaScript initial, compressé | < 250 Ko |
| Menu consultable hors ligne | oui, après une première visite |
| Score PWA Lighthouse | ≥ 90 |
| Android minimum | 8.0 |
| Largeur d'écran minimale | 360 px |
| Délai d'apparition d'une commande en cuisine | < 2 s |

---

## 19. Périmètre V1

| Fonction | V1 |
|---|---|
| Application cliente PWA + menu public partageable | ✔ |
| Panier, commande, personnalisation | ✔ |
| Livraison, retrait, sur place + QR | ✔ |
| **Caisse comptoir et téléphone** | ✔ *(nouveau)* |
| Logiciel restaurant, cuisine, statuts | ✔ |
| Menu, disponibilités, **stock** | ✔ |
| **Saisie du catalogue par le restaurant + assistant de configuration** | ✔ *(nouveau)* |
| Paiement espèces + simulateur | ✔ |
| **Mobile Money réel (USSD déclaré, attesté)** | ✔ *(nouveau — plus d'agrégateur requis)* |
| **Commission de la plateforme (1 %, accumulée puis reversée)** | ✔ *(nouveau)* |
| **Photos envoyées par le restaurant, allégées automatiquement** | ✔ *(nouveau)* |
| Notifications | ✔ |
| **Fidélité par points** | ✔ *(remonté de V2)* |
| **Page livreur web** | ✔ *(remplace l'application livreur V2)* |
| Historique et statistiques, heures de pointe | ✔ |
| APK Android | ✔ |
| Impression ticket cuisine | architecture prête, activable selon matériel |
| Multi-restaurants | schéma prêt, interface en V2 |

---

## 20. Tests et recette

Inscription et connexion ; panier et totaux ; les quatre canaux de commande ; paiements et confirmation
serveur ; réception immédiate côté restaurant ; transitions de statut, y compris interdites ; QR Codes de
toutes les tables ; commandes simultanées ; erreurs réseau ; permissions par rôle ; tailles d'écran ;
pilote avec le personnel avant ouverture au public.

---

## 21. Critères d'acceptation

Chaque critère est un **test automatisé**, pas une intention.

| # | Critère | Vérification |
|---|---|---|
| A1 | Une commande validée apparaît dans le logiciel restaurant en moins de 2 s | intégration temps réel |
| A2 | Le restaurant peut accepter, préparer et terminer une commande | machine à états |
| A3 | Le client reçoit chaque changement de statut | intégration temps réel |
| A4 | Le total serveur est identique au total client, options comprises | unitaire, calcul des prix |
| A5 | Le numéro de table est conservé de bout en bout | intégration sur place |
| A6 | Une commande de retrait est identifiable par numéro et par code | intégration retrait |
| A7 | Un produit indisponible ou en rupture ne peut pas être commandé | intégration menu et stock |
| A8 | Une transition de statut interdite est rejetée | machine à états |
| A9 | Un rôle `KITCHEN` ne peut pas modifier un prix | permissions |
| A10 | Un paiement n'est confirmé que par le serveur | intégration paiement |
| A11 | Un jeton de table invalide ou expiré est refusé | sécurité QR |
| A12 | Hors horaires, la création de commande est refusée | intégration horaires |
| A13 | Aucun montant n'est représenté en flottant | unitaire, montants |
| A14 | Le menu reste consultable sans réseau | service worker |
| A15 | Une commande saisie à la caisse compte dans le chiffre d'affaires du jour | intégration caisse |
| A16 | Les points de fidélité créditent le bon client au bon montant | unitaire, fidélité |
| A17 | Un gérant crée une catégorie, un produit et une option sans intervention technique | intégration menu |

---

## 22. Livrables

Cahier des charges consolidé ; décisions d'architecture ; code source des trois interfaces et du backend ;
schéma et migrations ; jeu de données de démonstration ; documentation API ; documentation de déploiement ;
guide d'exploitation restaurant ; plan de tests et rapport de recette ; procédure de sauvegarde et de
restauration ; APK Android.

---

## 23. Décisions restant à prendre

| Décision | Requise avant | Responsable |
|---|---|---|
| Menu, prix et suppléments réels d'Innova Group | pilote | Innova Group |
| Logo, couleurs et comptes sociaux réels | publication de l'APK | Innova Group |
| Numéros marchands Orange Money / Moov Money | activation du paiement en ligne | Innova Group |
| Taux de commission accepté par écrit | première facturation | Innova Group et Concepteur |
| Horaires réels et zones de livraison de Ouahigouya | activation de la livraison | Innova Group |
| Hébergement et nom de domaine | mise en production | Concepteur |
| Matériel : tablette, imprimante thermique | pilote | Innova Group |

---

## 24. Conclusion

BaraBite est une plateforme indépendante, propriétaire de ses données et de ses règles métier, servant
d'abord **Innova Group à Ouahigouya**. Elle est conçue pour fonctionner réellement là-bas : sur des
téléphones modestes, des réseaux capricieux et des données comptées — en encaissant **toutes** les
commandes du restaurant, pas seulement celles qui viennent de l'application. Sa marque étant une donnée et
non du code, elle peut ensuite servir un deuxième restaurant sans être réécrite.

**Concepteur du projet : Ange Stéphane Sawadogo**

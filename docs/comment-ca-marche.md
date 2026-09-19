# Comment tout fonctionne ensemble

Ce document répond à une seule question : **qui fait quoi, sur quel appareil, et comment les
morceaux se parlent.** Les autres documents décrivent chacun une pièce ; celui-ci montre la
machine.

---

## Il n'y a pas dix applications. Il y en a deux.

C'est le point le plus important, et celui qui prête le plus à confusion.

| | Qui l'ouvre | Sur quoi |
|---|---|---|
| **Savora** | Le client | Son téléphone, dans le navigateur ou l'application installée |
| **Savora Pro** | L'équipe du restaurant | Tablette, ordinateur de caisse, téléphone du livreur |

**« Cuisine » n'est pas une application.** C'est un **écran** de Savora Pro, au même titre que la
caisse ou les statistiques. La tablette accrochée au mur de la cuisine ouvre le même logiciel que
l'ordinateur du gérant — elle se connecte simplement avec le compte Cuisine, et ne voit que ce qui
la concerne.

Un seul logiciel, plusieurs écrans, chaque rôle voit les siens. Installer un logiciel différent par
poste multiplierait les mises à jour, les versions qui divergent et les bugs qu'on ne reproduit que
sur une machine.

---

## Ce qui relie les deux : un serveur, une base

```
   ┌──────────────┐                                   ┌─────────────────┐
   │   Savora     │                                   │   Savora Pro    │
   │  (le client) │                                   │   (l'équipe)    │
   └──────┬───────┘                                   └────────┬────────┘
          │                                                    │
          │          ┌──────────────────────────┐              │
          └─────────▶│      API Savora          │◀─────────────┘
                     │                          │
                     │  PostgreSQL  ·  fichiers │
                     │   25 tables     photos   │
                     └──────────────────────────┘
```

Les deux applications parlent au **même serveur**, qui écrit dans la **même base**. C'est pour cela
qu'un plat ajouté dans Savora Pro apparaît dans Savora : il n'y a rien à synchroniser, c'est la
même donnée lue de deux endroits.

**Le logiciel pilote l'application cliente.** Tout ce que voit le client — les plats, les prix, les
photos, les horaires, les zones de livraison, jusqu'au nom et aux couleurs du restaurant — a été
saisi dans Savora Pro. Rien n'est écrit en dur dans le code.

**Le temps réel** passe par un canal permanent (websocket) : une commande atteint la cuisine en
moins de deux secondes, sans que personne n'ait à rafraîchir quoi que ce soit. Quand ce canal tombe
— et il tombera, sur le réseau d'un restaurant — un rechargement périodique prend le relais. Le
service ne s'arrête pas, il ralentit.

---

## La vie d'une commande, de bout en bout

Suivons une commande passée depuis l'application, en livraison.

### 1. Le client commande — *son téléphone*

Il ouvre Savora, parcourt le menu, ajoute au panier. **Pas besoin de créer un compte** : un nom et
un numéro suffisent. Il choisit livraison, indique son secteur et un point de repère — c'est ainsi
qu'on se repère à Ouahigouya, pas par numéro de rue.

Il paie en espèces à la livraison, ou par Mobile Money.

> **S'il paie par Mobile Money**, l'application lui donne un code USSD déjà rempli avec le numéro du
> restaurant et le montant. Il compose, il paie, il recopie l'identifiant du SMS. **Sa commande
> n'avance pas encore** — et l'écran le lui dit.

### 2. La commande arrive — *tableau de bord et écran Commandes*

Alerte sonore. Le compteur rouge monte. La commande apparaît en tête de la file, marquée
« Application ».

Un employé **Accepte** — ou **Refuse**, avec un motif obligatoire. Le client est prévenu dans les
deux cas.

> **Si le paiement était en Mobile Money**, il faut d'abord aller à l'écran **Paiements** : coller
> le SMS reçu sur le téléphone du restaurant, vérifier que le montant et l'identifiant concordent,
> et attester. Tant que personne n'a attesté, rien n'est payé. *Celui qui paie ne confirme jamais
> son propre paiement.*

### 3. La cuisine prépare — *la tablette au mur*

La commande apparaît sur l'écran **Cuisine**. Gros caractères, minuteur, les produits et les
consignes du client — rien d'autre.

**Commencer**, puis **Commande prête**. Deux boutons sur toute la journée. Le client reçoit une
notification à chaque étape, sans que personne n'ait à l'appeler.

### 4. Le livreur emporte — *son téléphone*

Au comptoir, écran **Commandes**, onglet « À livrer » : un employé **confie la commande à un
livreur**.

Le livreur, lui, se connecte avec son propre compte et ouvre directement **Ma tournée**. Il n'y voit
que **ses** courses — le secteur, le point de repère, le numéro du client à appeler d'un geste, et le
montant à encaisser en grand. Ni la caisse, ni les statistiques, ni le menu, ni le chiffre
d'affaires, et pas même la file des autres commandes : le serveur lui refuse.

Ce n'est pas de la méfiance envers l'équipe. Un téléphone de livreur est celui qui circule le plus,
se prête le plus et se perd le plus.

Deux boutons pour sa journée : **Je pars livrer**, puis **Commande remise**. Le client suit tout cela
en direct sur son téléphone.

### 5. C'est fini — *automatiquement*

La commande passe en terminée. Le chiffre d'affaires du jour se met à jour. Si la vente est venue de
l'application, **1 % s'inscrit au compte de la plateforme** — pas prélevé, inscrit. Le restaurant
reverse le cumul en fin de période.

---

## Les autres chemins

L'application n'est pas le seul moyen de commander, et c'est délibéré : un logiciel qui ne
connaîtrait que les commandes de l'application afficherait un chiffre d'affaires faux.

| Canal | Qui saisit | Où | Commission |
|---|---|---|---|
| **Application** | Le client | Son téléphone | 1 % |
| **QR de table** | Le client, assis | Son téléphone | 1 % |
| **Comptoir** | Un employé | Écran Caisse | **aucune** |
| **Téléphone** | Un employé | Écran Caisse | aucune |

Une commande au comptoir démarre directement en préparation : l'employé qui la tape est sur place,
il n'a personne à attendre. Elle passe même lorsque le restaurant est marqué fermé, pour la même
raison.

> **Saisissez tout au comptoir, même les ventes en espèces sans discussion.** C'est ce qui rend le
> chiffre d'affaires, les statistiques et le stock vrais. Une commande prise sur un carnet n'existe
> pas pour le logiciel. C'est aussi pourquoi le comptoir n'est jamais commissionné : le jour où
> saisir une vente coûterait de l'argent, l'équipe cesserait de le faire.

---

## Qui voit quoi

Chaque employé a **son propre compte**. Ce n'est pas une formalité : c'est ce qui permet de savoir
qui a accepté, refusé, remis ou attesté un paiement.

| Rôle | Ouvre sur | Ce qu'il voit |
|---|---|---|
| **Cuisine** | Cuisine | Les commandes à préparer, et de quoi signaler un produit épuisé. **Ni les prix, ni le chiffre d'affaires.** |
| **Caisse** | Tableau de bord | La caisse, les commandes, les tables, l'encaissement, les paiements à vérifier |
| **Livreur** | Ma tournée | Ses courses à lui, et rien d'autre |
| **Gérant** | Tableau de bord | Tout le service, plus le menu, les statistiques, les remboursements et la commission |
| **Administrateur** | Tableau de bord | Tout, y compris les employés et l'identité de la marque |

**Chaque poste ouvre le logiciel sur l'écran depuis lequel il travaille.** La tablette de la cuisine
affiche la file des plats, le téléphone du livreur sa tournée. Personne ne traverse un écran qui ne
le concerne pas pour atteindre le sien — et personne n'est renvoyé sur un écran qui lui sera refusé à
son tour.

**Le chiffre d'affaires n'est pas une information de service.** Le tableau de bord appartient au
comptoir et à la direction. La cuisine et le livreur ont besoin de voir des commandes ; ce n'est pas
la même chose que voir les résultats de l'entreprise, et ce sont désormais deux droits distincts dans
le code.

Le cloisonnement est vérifié **côté serveur**, à chaque requête. Masquer un bouton n'est qu'une
politesse : un employé qui taperait l'adresse d'un écran interdit se ferait refuser par le serveur,
pas par l'interface.

---

## Le matériel, concrètement

| Poste | Appareil | Ce qu'il ouvre |
|---|---|---|
| Comptoir | Ordinateur ou tablette | Savora Pro — écran Caisse |
| Cuisine | Tablette au mur | Savora Pro — écran Cuisine |
| Gérant | Ordinateur, ou son téléphone | Savora Pro — tous les écrans |
| Livreur | Son propre téléphone | Savora Pro — écran Ma tournée |
| Client | Son propre téléphone | Savora |

Savora Pro s'ouvre dans un navigateur, ou s'installe sur Windows (`Savora Pro.exe`). Les deux
montrent exactement la même chose : l'installateur ajoute un raccourci, le plein écran, et empêche
de partir ailleurs en plein service.

---

## Ce qui n'existe pas, et qu'il faut savoir

**Rien n'est imprimé en cuisine.** La commande s'affiche à l'écran, elle ne sort pas sur papier. Ce
choix a une raison : un ticket papier ne se met pas à jour. Si le client annule, le ticket reste sur
le passe et le plat part quand même.

L'impression thermique se justifie dans deux cas — une cuisine où l'on ne touche pas un écran avec
les mains grasses, et les coupures de courant. Elle n'est pas faite ; elle s'ajoute si le besoin est
réel.

**Le paiement Mobile Money n'est pas automatique.** Personne ne confirme un paiement à la place du
restaurant. C'est ce qui permet de se passer d'un agrégateur et de sa commission, et cela coûte
quelques secondes de vérification par commande ([ADR 008](adr/008-paiement-declare-atteste.md)).

---

## Pour voir tout cela tourner

```bash
npm run demarrer
```

La commande lance les trois briques et affiche l'adresse à ouvrir depuis un téléphone sur le même
Wi-Fi. Ouvrez Savora Pro sur l'ordinateur, Savora sur le téléphone, ajoutez un plat dans le menu :
il apparaît immédiatement côté client. Commandez, et regardez la commande arriver.

C'est le meilleur moyen de comprendre le reste.

### Et pour tout revérifier d'un coup

```bash
npm test                              # 208 tests : règles métier, API, temps réel
npm run build --workspace @savora/client
npm run servir                        # sert la construction, relaie l'API et le temps réel
npm run verifier:parcours             # rejoue chaque rôle dans un vrai navigateur
npm run verifier:iphone               # rejoue le parcours client dans le moteur de Safari
npm run verifier:pwa                  # manifeste, service worker, consultation hors ligne
```

Le dernier commande fait ce qu'aucun test unitaire ne sait faire : il **pose un doigt** sur les
boutons, poste par poste, et vérifie qu'ils répondent. Il existe parce que le bouton « Commander » du
panier a été, un temps, dessiné sous la barre de navigation : visible, à moitié, et sourd. Les 202
tests étaient verts, et l'application était inutilisable.

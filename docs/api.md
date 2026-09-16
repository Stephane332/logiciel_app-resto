# API

Base : `/api/v1` · Format : JSON · Montants : **entiers de francs CFA**

Authentification par jeton porteur : `Authorization: Bearer <jeton d'accès>`.

Les erreurs partagent une forme unique, avec un **code stable** destiné aux interfaces et un message
en français destiné à l'utilisateur. Branchez-vous sur le code, jamais sur le texte.

```json
{ "error": { "code": "ITEMS_UNAVAILABLE", "message": "Ces produits ne sont plus disponibles : Double Cheese.", "details": { "unavailable": ["Double Cheese"] } } }
```

| Statut | Signification |
|---|---|
| 400 | Requête ou validation invalide (`VALIDATION_ERROR` détaille chaque champ) |
| 401 | Jeton absent, invalide ou expiré |
| 403 | Rôle insuffisant |
| 404 | Ressource introuvable |
| 409 | Conflit : total divergent, transition interdite, doublon |
| 422 | Règle métier : restaurant fermé, produit épuisé, zone non desservie |
| 429 | Débit limité |

---

## Public — sans authentification

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/restaurant` | Marque, horaires, état d'ouverture, zones actives, moyens de paiement |
| `GET` | `/menu` | Catégories et produits commandables |
| `GET` | `/menu/products/:slug` | Détail d'un produit et ses options |
| `POST` | `/tables/resolve` | Résout un QR Code de table et ouvre une session |
| `POST` | `/orders` | Crée une commande (compte facultatif) |
| `GET` | `/orders/:id/track` | Suit une commande par son identifiant |

> Le menu est public par choix : c'est ce qui permet à un lien partagé sur TikTok ou Facebook de
> mener directement à la carte, et à un QR Code de table d'ouvrir le menu sans installation.

---

## Authentification

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/auth/register` | Inscription (mot de passe facultatif) |
| `POST` | `/auth/login` | Connexion |
| `POST` | `/auth/refresh` | Renouvelle la session ; le jeton présenté est révoqué |
| `POST` | `/auth/logout` | Révoque le jeton de rafraîchissement |
| `GET` · `PATCH` | `/auth/me` | Profil |

Débit limité à 10 tentatives par minute et par adresse sur l'inscription et la connexion.

---

## Commandes

### Création

```http
POST /api/v1/orders
```

```json
{
  "type": "PICKUP",
  "channel": "APP",
  "paymentMethod": "CASH",
  "expectedTotal": 4000,
  "customerName": "Aminata Ouédraogo",
  "customerPhone": "+22670112233",
  "lines": [{ "productId": "...", "quantity": 1, "optionItemIds": ["..."] }]
}
```

| Champ | Note |
|---|---|
| `type` | `DELIVERY` · `PICKUP` · `DINE_IN` |
| `channel` | `APP` · `COUNTER` · `PHONE` · `QR_TABLE`. Les canaux de caisse exigent un employé. |
| `expectedTotal` | Facultatif mais recommandé : tout écart avec le total serveur renvoie `409 TOTAL_MISMATCH` |
| `tableToken` | Requis pour `DINE_IN` |
| `address` ou `addressId` | Requis pour `DELIVERY` |

**Les prix viennent de la base, jamais de la requête.** Seules les quantités et les options sont
lues ; le serveur recalcule tout.

### Transitions

Toutes exigent une permission et respectent la machine à états. Une transition interdite renvoie
`409` avec un code explicite (`UNKNOWN_TRANSITION`, `WRONG_ORDER_TYPE`, `FORBIDDEN_ACTOR`,
`REASON_REQUIRED`, `TERMINAL`).

| Route | Permission | Effet |
|---|---|---|
| `POST /orders/:id/accept` | `order:accept` | `PENDING → ACCEPTED` |
| `POST /orders/:id/reject` | `order:reject` | `→ REJECTED` — **motif obligatoire** |
| `POST /orders/:id/prepare` | `order:prepare` | `ACCEPTED → PREPARING` |
| `POST /orders/:id/ready` | `order:ready` | `PREPARING → READY` |
| `POST /orders/:id/handover` | `order:handover` | `READY → PICKED_UP` — vérifie le code de retrait |
| `POST /orders/:id/serve` | `order:serve` | `READY → SERVED` (sur place) |
| `POST /orders/:id/assign` | `order:assign` | `READY → ASSIGNED` (livraison) |
| `POST /orders/:id/depart` | `order:deliver` | `ASSIGNED → OUT_FOR_DELIVERY` |
| `POST /orders/:id/delivered` | `order:deliver` | `OUT_FOR_DELIVERY → DELIVERED` |
| `POST /orders/:id/cancel` | client, propriétaire | Annulation avant acceptation |
| `POST /orders/:id/cancel-staff` | `order:cancel:any` | Annulation par le restaurant, motif obligatoire |

### Consultation

| Route | Permission |
|---|---|
| `GET /orders?scope=active\|today\|all` | `order:read:all` |
| `GET /orders/:id` | `order:read:all` — renvoie aussi les actions permises à ce rôle |
| `GET /orders/by-code/:code` | `order:read:all` — tolère les confusions de saisie |
| `GET /orders/mine` | client authentifié |
| `GET /delivery/mine` | livreur — ses livraisons en cours |

---

## Paiements

| Route | Rôle | Accès |
|---|---|---|
| `POST /payments/:orderId/initiate` | Renvoie le code USSD pré-rempli, le lien composable et le numéro marchand | client |
| `POST /payments/:orderId/declare` | Le client déclare avoir payé et recopie l'identifiant du SMS → `DECLARED` | client |
| `GET /payments/to-verify` | File des paiements déclarés en attente d'attestation | `payment:collect` |
| `POST /payments/read-sms` | Lit un SMS d'opérateur et désigne la commande correspondante | `payment:collect` |
| `POST /payments/:paymentId/attest` | **Seul chemin** vers `CONFIRMED` en Mobile Money | `payment:collect` |
| `POST /payments/webhook/:provider` | Confirmation automatique, si un agrégateur est branché un jour | signature |
| `POST /payments/:orderId/collect` | Encaissement au comptoir | `payment:collect` |
| `POST /payments/:paymentId/refund` | Remboursement tracé | `payment:refund` |

**Aucune route accessible au client ne produit `CONFIRMED`.** `declare` place le paiement en `DECLARED` —
une affirmation non vérifiée — et rien de plus : c'est l'attestation par un employé habilité, faite sur le
SMS reçu par le restaurant lui-même, qui confirme ([ADR 008](adr/008-paiement-declare-atteste.md)).

`read-sms` ne tranche jamais au hasard : l'identifiant de transaction prime sur le montant, et si
plusieurs commandes correspondent sans identifiant pour les départager, la réponse est `AMBIGUOUS` et
laisse l'employé décider.

Attester deux fois n'encaisse pas deux fois : un paiement déjà `CONFIRMED` renvoie `alreadyConfirmed`.
Le webhook, lui, vérifie la signature **puis interroge l'agrégateur** avant de confirmer, et recoupe le
montant ; rejoué, il ne réencaisse pas, la référence du fournisseur étant unique.

---

## Menu, tables, administration

| Route | Permission |
|---|---|
| `GET /menu/manage` | personnel + `menu:read` — expose stock et produits désactivés |
| `POST` · `PATCH` · `DELETE` `/menu/categories`, `/menu/products` | `menu:write` |
| `PATCH /menu/products/:id/availability` | `stock:write` — accessible à la cuisine |
| `GET` · `POST` · `PATCH` · `DELETE` `/tables` | `table:read` / `table:write` |
| `POST /tables/:id/regenerate-qr` | `table:write` — invalide le QR imprimé |
| `PATCH /restaurant/brand` | `brand:write` |
| `PATCH /restaurant/settings` · `PUT /restaurant/hours` | `settings:write` |
| `GET` · `POST` · `PATCH` · `DELETE` `/restaurant/delivery-zones` | `delivery:zone:write` |
| `GET /restaurant/setup` | `settings:write` — état de la configuration initiale |
| `GET /stats/today` | `order:read:all` |
| `GET /stats/range?days=` · `/stats/top-products` | `stats:read` |
| `GET` · `POST` · `PATCH` `/employees` | `employee:write` |

Un produit déjà commandé n'est jamais supprimé : il est retiré du menu et conservé pour l'historique.

---

## Photos des produits

| Route | Rôle | Accès |
|---|---|---|
| `POST /uploads/image` | Envoie une photo, renvoie son adresse et celle de sa vignette | `menu:write` |
| `GET /api/v1/media/:restaurant/:fichier` | Sert une photo | public |

Le fichier reçu est **toujours décodé et réencodé**, jamais servi tel quel. L'image est ramenée à
1 200 px de large en WebP (60 à 120 Ko), avec une vignette de 400 px : un menu de trente plats passe
de 150 Mo à moins de 3 Mo, ce qui n'est pas un détail sur un forfait compté. Le réencodage écarte au
passage ce qui se cacherait derrière une extension, et efface les métadonnées EXIF — donc les
coordonnées GPS que le téléphone glisse dans chaque cliché.

Les adresses enregistrées sont **relatives** (`/media/…`) pour survivre à un changement de domaine ;
les interfaces les résolvent avec `mediaUrl()`. Les médias sont servis **sous le préfixe de l'API**,
et non à la racine : servis à la racine, ils tombaient dans le repli SPA de l'interface, qui
renvoyait sa page HTML à la place de l'image, sans la moindre erreur pour le signaler.

---

## Commission de la plateforme

| Route | Rôle | Accès |
|---|---|---|
| `GET /commission/summary` | Taux, encours de la période, reste à reverser | `commission:read` |
| `GET /commission/entries` | Détail commande par commande, avec assiette et taux | `commission:read` |
| `GET /commission/settlements` | Relevés arrêtés | `commission:read` |
| `POST /commission/settlements/close` | Arrête une période et fige son montant | `commission:read` |
| `GET /commission/settlements/:id/transfer` | Code USSD de reversement, déjà rempli | `commission:read` |
| `POST /commission/settlements/:id/declare` | Le restaurant déclare avoir reversé | `commission:read` |

`commission:read` n'est accordé qu'au gérant et à l'administrateur : ce que le restaurant doit à la
plateforme est une affaire de contrat, pas de service ([ADR 009](adr/009-commission-plateforme.md)).

**Aucune route cliente n'expose la commission.** Le client paie le prix affiché ; ce que le
restaurant reverse ne le regarde pas — un test le vérifie sur la route de suivi.

La période en cours ne peut pas être arrêtée : figer un total auquel des ventes vont encore
s'ajouter produirait une facture invérifiable. `close` répond alors `400 PERIOD_STILL_OPEN`.

---

## Temps réel

Socket.IO, chemin `/realtime`.

```js
io(API_URL, { path: '/realtime', auth: { token } });       // personnel
io(API_URL, { path: '/realtime', auth: { orderId } });     // client suivant sa commande
```

| Salon | Qui | Événements |
|---|---|---|
| `restaurant:{id}` | personnel authentifié uniquement | `order:created`, `order:updated`, `payment:updated`, `menu:updated`, `table:updated` |
| `order:{id}` | quiconque connaît l'identifiant | `order:status`, `payment:updated` |
| `user:{id}` | utilisateur authentifié | notifications |

Un client n'entre jamais dans le salon du restaurant : il y verrait les commandes des autres. Un
test automatisé le vérifie.

Le temps réel est un confort, jamais une dépendance : chaque écran critique sait aussi se recharger
seul (ADR 006).

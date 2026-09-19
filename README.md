# Savora

> **Vous découvrez le projet ?** Lisez [`docs/comment-ca-marche.md`](docs/comment-ca-marche.md) :
> qui fait quoi, sur quel appareil, et comment les morceaux se parlent.


> Plateforme de commande et de gestion pour la restauration rapide.
> Premier client : **Mon restaurant** — Ouahigouya, Burkina Faso.

Une application cliente (PWA installable + APK Android), un logiciel restaurant (caisse, cuisine,
tables, menu, statistiques) et un backend unique qui porte toutes les règles métier.

📄 [Cahier des charges](docs/cahier-des-charges.md) ·
🏛 [Décisions d'architecture](docs/adr/) ·
🔌 [API](docs/api.md) ·
🚀 [Déploiement](docs/deploiement.md) ·
📱 [APK Android](docs/apk-android.md) ·
👩‍🍳 [Guide du restaurant](docs/exploitation-restaurant.md)

---

## Ce que la plateforme fait

| | |
|---|---|
| **Quatre canaux de commande** | Application, comptoir, téléphone, QR Code de table — **une seule file de cuisine** |
| **Trois modes de réception** | Livraison, retrait avec code, sur place |
| **Temps réel** | Une commande atteint la cuisine en moins de deux secondes (mesuré : ~400 ms) |
| **Hors ligne** | Le menu reste consultable sans réseau ; le panier survit à tout |
| **Autonome** | Le restaurant saisit lui-même ses produits, prix, photos, tables et horaires |
| **Sans store** | Le QR Code de table ouvre le menu sans rien installer |
| **Fidélité** | Points par franc dépensé, dès la V1 |

## Architecture

```
apps/
  api/          Fastify + Prisma + PostgreSQL + Socket.IO — toutes les règles métier
  client/       PWA cliente (React + Vite) → Capacitor → APK Android
  restaurant/   Logiciel restaurant (React + Vite, ordinateur et tablette)
packages/
  shared/       Machine à états, calcul des prix, permissions — fonctions pures, testées
  api-client/   Noyau HTTP, types et points d'entrée, partagés par les deux interfaces
  ui/           Jetons de design et logo
docs/           Cahier des charges, décisions, API, déploiement, guides
infra/          PostgreSQL, images de production, sauvegardes
```

**Règle d'or :** aucune application n'accède directement à la base. Les transitions de statut, les
totaux, les permissions et la confirmation des paiements vivent dans l'API et uniquement là. Les
interfaces *prévoient*, le serveur *décide*.

## Démarrer

```bash
npm install
npm run db:up                  # PostgreSQL dans Docker
npm run db:migrate
npm run db:seed                # jeu de démarrage — le restaurant saisira le sien

npm run dev                    # API                  → http://localhost:4000
npm run dev:client             # application cliente  → http://localhost:5173
npm run dev:restaurant         # logiciel restaurant  → http://localhost:5174
```

Comptes de démonstration — **à changer avant toute mise en production** :

| Rôle | Téléphone | Mot de passe |
|---|---|---|
| Administrateur | 70 00 00 01 | `savora2026` |
| Gérant | 70 00 00 02 | `savora2026` |
| Caisse | 70 00 00 03 | `savora2026` |
| Cuisine | 70 00 00 04 | `savora2026` |
| Livreur | 70 00 00 05 | `savora2026` |

Pour démontrer l'application cliente sans ouvrir le logiciel restaurant, un simulateur fait avancer
les commandes tout seul :

```bash
npm run demo:kitchen
```

## Vérifier

```bash
npm test        # règles métier, API sur base réelle, temps réel
npm run typecheck
```

Les tests sont la traduction exécutable des critères d'acceptation du cahier des charges (§ 21) :
transitions interdites, totaux, permissions, concurrence, QR Codes, horaires, fidélité, délai
d'affichage en cuisine.

---

**Concepteur :** Ange Stéphane Sawadogo

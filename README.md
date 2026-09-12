# BaraBite

> Plateforme de commande et de gestion pour la restauration rapide.
> Premier client : **Innova Group** — Ouahigouya, Burkina Faso.

Une application cliente (PWA installable + APK Android), un logiciel restaurant (caisse, cuisine,
tables, menu, statistiques), une page livreur, et un backend unique qui porte toutes les règles métier.

📄 **[Cahier des charges](docs/cahier-des-charges.md)** · 🏛 **[Décisions d'architecture](docs/adr/)**

---

## Ce que la plateforme fait

| | |
|---|---|
| **Quatre canaux de commande** | Application, comptoir, téléphone, QR Code de table — **une seule file de cuisine** |
| **Trois modes de réception** | Livraison, retrait avec code, sur place |
| **Temps réel** | Une commande apparaît en cuisine en moins de deux secondes |
| **Hors ligne** | Le menu reste consultable sans réseau ; les commandes attendent la reconnexion |
| **Autonome** | Le restaurant saisit lui-même ses produits, prix, photos, tables et horaires |
| **Sans store** | Le QR Code de table ouvre le menu sans installer quoi que ce soit |

## Architecture

```
apps/
  api/          Fastify + Prisma + PostgreSQL + Socket.IO — toutes les règles métier
  client/       PWA cliente (React + Vite) → Capacitor → APK Android
  restaurant/   Logiciel restaurant (React + Vite, ordinateur et tablette)
packages/
  shared/       Machine à états, calcul des prix, permissions — fonctions pures, testées
  ui/           Design system
docs/           Cahier des charges, décisions d'architecture, API, déploiement
infra/          PostgreSQL, intégration continue, build APK
```

**Règle d'or :** aucune application n'accède directement à la base. Les transitions de statut, les
totaux, les permissions et la confirmation des paiements vivent dans l'API et uniquement là. Les
interfaces *prévoient*, le serveur *décide*.

## Démarrer

```bash
npm install
npm run db:up          # PostgreSQL dans Docker
npm run db:migrate
npm run db:seed        # jeu de démarrage — le restaurant saisira le sien
npm run dev            # API
npm run dev:client     # application cliente
npm run dev:restaurant # logiciel restaurant
```

## Vérifier

```bash
npm test        # règles métier : statuts, montants, permissions, fidélité, horaires
npm run typecheck
```

Les tests sont la traduction exécutable des critères d'acceptation du cahier des charges (§ 21).

---

**Concepteur :** Ange Stéphane Sawadogo

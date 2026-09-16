# Savora — remise du projet

**Branche :** `claude/gifted-brown-1tc9ma` · **202 tests au vert** · 18 800 lignes de TypeScript

---

## Les trois produits

| | Ce que c'est | Pour qui |
|---|---|---|
| **Savora** | Application cliente, installable depuis le navigateur (PWA) et en APK Android | Le client qui commande |
| **Savora Pro** | Logiciel restaurant : caisse, cuisine, tables, menu, statistiques, commission | L'équipe du restaurant |
| **API Savora** | Le serveur qui relie les deux | Hébergé sur un VPS |

Le logiciel pilote l'application cliente. **Tout ce que voit le client — plats, prix, photos,
disponibilités — a été saisi depuis Savora Pro.** Aucun catalogue n'est livré d'avance : le menu
en ligne dit la vérité sur ce qui sort réellement de la cuisine, ou il ne dit rien.

---

## Comment récupérer les livrables

### APK Android

**Avant de construire, il faut l'adresse de ton serveur.** Un APK ne vit pas sur le même domaine
que l'API : sans adresse absolue, il s'installe, s'ouvre, et reste vide. Le workflow refuse
désormais de construire sans elle — un workflow rouge se comprend en dix secondes, un APK mort se
diagnostique en une journée.

Deux façons de la donner :
- au lancement du workflow, dans le champ **URL de l'API** ;
- une fois pour toutes : **Réglages → Secrets and variables → Actions → Variables**,
  `API_URL = https://api.ton-domaine.bf/api/v1`.

Ensuite : onglet **Actions** → **APK Android** → **Run workflow** → artefact `savora-apk`.
Version de débogage : elle s'installe sans certificat, Android affiche un avertissement au premier
lancement.

### Logiciel Windows
Onglet **Actions** → workflow **Logiciel Windows** → artefact `savora-pro-windows`.
Installateur classique : double-clic, raccourci sur le bureau.

Au premier lancement, le logiciel demande **l'adresse du serveur**. Une seule fois — il s'en
souvient ensuite. Le même installateur sert tous les restaurants.

### PWA
La PWA est l'application cliente servie par un navigateur. Son lien **dépend de l'hébergement** :
c'est `https://votre-domaine.bf`, une fois le déploiement fait (voir `docs/deploiement.md`).
Le client ouvre ce lien, Chrome propose « Installer », et l'application apparaît sur son écran
d'accueil comme n'importe quelle autre.

---

## Pour voir tourner le tout, ici et maintenant

```bash
npm install
npm run db:migrate && npm run db:seed
npm run dev            # API           → :4000
npm run dev:restaurant # Savora Pro    → :5174
npm run dev:client     # Savora        → :5173
```

Connexion à Savora Pro : **70 00 00 01**, mot de passe **savora2026**.
À changer avant toute mise en production — c'est écrit dans la liste de contrôle.

Le catalogue est vide au départ : c'est voulu. **Menu → Ajouter un plat**, et il apparaît
immédiatement côté client.

---

## Ce qui est fait, et vérifié

- **Commande sans compte** — un nom et un téléphone suffisent.
- **Quatre canaux** : application, comptoir, téléphone, QR de table. Tous comptés dans le
  chiffre d'affaires.
- **Mobile Money sans agrégateur** : code USSD pré-rempli, déclaration du client, attestation du
  restaurant. Aucune commission d'intermédiaire ([ADR 008](docs/adr/008-paiement-declare-atteste.md)).
- **Commission de la plateforme** : 1 % sur les ventes de l'application, accumulé puis reversé
  ([ADR 009](docs/adr/009-commission-plateforme.md)).
- **Photos envoyées depuis le téléphone**, allégées automatiquement — 6 Mo deviennent 80 Ko.
- **Temps réel** : une commande atteint la cuisine en moins de deux secondes.
- **Fidélité, stock, zones de livraison, employés et rôles, statistiques.**

---

## Ce qui reste, et qui ne dépend pas de moi

| À faire | Pourquoi ce n'est pas fait |
|---|---|
| **Héberger** (VPS + domaine + HTTPS) | Il faut un compte d'hébergement et un domaine à ton nom |
| **Vérifier le code USSD marchand** | `*144*10*…` n'est pas documenté par Orange ; à confirmer avec un vrai téléphone |
| **Menu, prix et photos réels** | Ce sont les plats du restaurant, personne d'autre ne peut les fournir |
| **Secteurs livrés à Ouahigouya** | Seul le restaurant connaît ses zones et ses tarifs |
| **Changer les mots de passe et les secrets** | À faire au déploiement, jamais avant |

Le reste de la liste est dans [`docs/deploiement.md`](docs/deploiement.md).

---

## Où lire quoi

| Document | Contenu |
|---|---|
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Le besoin, corrigé et complété |
| [`docs/adr/`](docs/adr/) | Les neuf décisions structurantes, et leurs raisons |
| [`docs/exploitation-restaurant.md`](docs/exploitation-restaurant.md) | Guide de l'équipe, écrit pour elle |
| [`docs/deploiement.md`](docs/deploiement.md) | Du VPS nu à l'ouverture au public |
| [`docs/api.md`](docs/api.md) | Routes, permissions, temps réel |
| [`docs/recette.md`](docs/recette.md) | Chaque critère relié à son test |

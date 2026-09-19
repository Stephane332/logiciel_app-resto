# Savora — remise du projet

**Branche :** `claude/gifted-brown-1tc9ma`

**208 tests** · **44 contrôles de parcours** (chaque rôle, vrai navigateur) · **14 contrôles PWA** — tout au vert

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

## Les deux fichiers à télécharger, maintenant

Construits sur le dernier code, le 19 septembre. Il faut être connecté à GitHub pour télécharger un
artefact.

| Quoi | Où | Taille |
|---|---|---|
| **APK Android** | [construction du 19/09](https://github.com/Stephane332/logiciel_app-resto/actions/runs/35447153932) → artefact `savora-apk` | 4 Mo |
| **Installateur Windows** | [construction du 19/09](https://github.com/Stephane332/logiciel_app-resto/actions/runs/35447150635) → artefact `savora-pro-windows` | 82 Mo |

Les deux te demanderont **l'adresse du serveur** au premier lancement, une seule fois. Pour un essai
immédiat : `npm run demarrer` sur ton ordinateur affiche l'adresse à saisir.

**L'APK est une version de débogage** — elle s'installe sans certificat, et Android affiche un
avertissement au premier lancement. Une version signée demande un magasin de clés (secret
`ANDROID_KEYSTORE_BASE64`) ; le workflow la construit automatiquement dès qu'il existe.

### La PWA — et les clients sur iPhone

**Un iPhone n'installe pas d'APK. La PWA est sa seule voie**, et elle passe obligatoirement par une
adresse en HTTPS : Safari n'installe rien depuis une adresse en clair, et n'y démarre pas le service
worker. Il n'y a pas de contournement — c'est une règle du navigateur, pas un réglage.

#### Pour essayer sur un iPhone dès aujourd'hui

```bash
npm run dev                                  # dans un terminal
npm run build --workspace @savora/client     # dans un second
npm run partager
```

La commande affiche une vraie adresse `https://…`. Sur l'iPhone, **ouvrir dans Safari** — pas Chrome,
sur iOS seul Safari sait installer une application — puis bouton Partager → « Sur l'écran d'accueil ».

Cette adresse est un banc d'essai : elle change à chaque lancement, meurt avec le script, et tout
passe par ton ordinateur. Elle demande `cloudflared`, une seule fois (`sudo apt install cloudflared`).

#### Pour l'adresse définitive, celle qu'on donne aux clients

Un nom de domaine et un serveur. La pile de production fait le HTTPS toute seule désormais :
`DOMAINE=ton-domaine.bf` puis une commande, et `https://ton-domaine.bf` est en service, certificat
compris. Voir [`docs/deploiement.md`](docs/deploiement.md). **C'est ce lien-là, la PWA** — le même
pour les iPhone et les Android.

#### Ce qui est déjà vérifié côté iPhone

Le parcours complet a été rejoué dans **WebKit**, le moteur de Safari, aux dimensions d'un iPhone 13
(`npm run verifier:iphone`, 14 contrôles) : commande aboutie, code de retrait, service worker actif,
aucun débordement horizontal, aucune erreur JavaScript, et les quatre balises dont iOS se sert pour
l'installation.

Une correction en est sortie : la barre d'état était réglée sur « texte blanc » — un reste de
l'ancienne interface sombre. Sur le fond crème actuel, l'heure et la batterie de l'iPhone étaient
devenues blanches sur crème, donc invisibles.

---

## Comment reconstruire les livrables

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

**Pour essayer avant d'avoir un domaine :** construis l'APK sans adresse et il te la demandera au
premier lancement. Lance `npm run demarrer` sur ton ordinateur, saisis l'adresse qu'il affiche, et
l'application se connecte. Cet écran n'apparaît jamais dans un APK construit avec son adresse — un
client n'a pas à taper une adresse de serveur pour commander.

### Logiciel Windows
Onglet **Actions** → workflow **Logiciel Windows** → artefact `savora-pro-windows`.
Installateur classique : double-clic, raccourci sur le bureau.

Au premier lancement, le logiciel demande **l'adresse du serveur**. Une seule fois — il s'en
souvient ensuite. Le même installateur sert tous les restaurants.

### PWA
Rien à construire séparément : la PWA **est** l'application cliente, servie en HTTPS. Le déploiement
la met en ligne sur `https://ton-domaine.bf`, Chrome propose « Installer », et elle apparaît sur
l'écran d'accueil du client comme n'importe quelle autre application.

---

## Tout revérifier soi-même

```bash
npm test                              # 208 tests : règles métier, API, temps réel
npm run verifier:pwa                  # 14 contrôles : manifeste, service worker, hors ligne
npm run verifier:iphone               # 14 contrôles : le parcours dans le moteur de Safari
npm run verifier:parcours             # 44 contrôles : chaque rôle, dans un vrai navigateur
```

Les deux derniers demandent les serveurs lancés et la construction servie :
`npm run dev`, `npm run dev:restaurant`, puis `npm run build --workspace @savora/client` et
`npm run servir`.

`verifier:parcours` fait ce qu'aucun test unitaire ne sait faire : il **pose un doigt** sur les
boutons. Il existe parce que le bouton « Commander » du panier a été, un temps, dessiné sous la barre
de navigation — visible, à moitié, et sourd. Les 202 tests étaient verts, et l'application était
inutilisable.

---

## Pour voir tourner le tout, ici et maintenant

```bash
npm install
npm run db:migrate && npm run db:seed
npm run demarrer
```

Une seule commande. Elle lance les trois serveurs et affiche **l'adresse à taper sur ton
téléphone**, à condition qu'il soit sur le même Wi-Fi.

Ce qu'elle affiche, et pourquoi ça compte :

| | |
|---|---|
| `http://<ton-ip>:5173` | La PWA, depuis ton téléphone |
| `http://<ton-ip>:5174` | Le logiciel, depuis une tablette |
| `<ton-ip>:4000` | Ce que l'APK demande à son premier lancement |

**Une limite à connaître :** Android ne propose « Installer » que sur une adresse sécurisée. Sur un
réseau local, la PWA s'utilise dans le navigateur mais ne s'installe pas. L'installation demande un
domaine en HTTPS — c'est la seule chose que l'hébergement débloque et que rien ne remplace.

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
| [`docs/comment-ca-marche.md`](docs/comment-ca-marche.md) | **Commencez par là.** Qui fait quoi, sur quel appareil, et comment les morceaux se parlent |
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Le besoin, corrigé et complété |
| [`docs/adr/`](docs/adr/) | Les neuf décisions structurantes, et leurs raisons |
| [`docs/exploitation-restaurant.md`](docs/exploitation-restaurant.md) | Guide de l'équipe, écrit pour elle |
| [`docs/deploiement.md`](docs/deploiement.md) | Du VPS nu à l'ouverture au public |
| [`docs/api.md`](docs/api.md) | Routes, permissions, temps réel |
| [`docs/recette.md`](docs/recette.md) | Chaque critère relié à son test |

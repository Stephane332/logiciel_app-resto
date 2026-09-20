# La livraison depuis la maison, sans louer de serveur

> Ce document répond à une seule question : **comment un client assis chez lui commande sur le PC
> posé dans l'arrière-boutique du restaurant.** Tout le reste — commander sur place, la caisse, la
> cuisine, les tablettes de l'équipe — fonctionne déjà sans rien de ce qui suit, sur le seul Wi-Fi
> du restaurant.

---

## Pourquoi ce n'est pas automatique

Le PC du restaurant est sur un réseau privé. Son adresse — `192.168.1.20` — n'existe que dans ce
bâtiment ; des millions de réseaux dans le monde utilisent la même. Un téléphone ailleurs en ville
ne peut pas la joindre : ce n'est pas un réglage manquant, c'est ainsi que les réseaux privés sont
faits.

**La redirection de port ne résout pas le problème au Burkina.** Elle suppose que l'abonnement ait
une adresse publique à lui. Chez la plupart des fournisseurs ici, plusieurs centaines d'abonnés
partagent la même adresse publique (on appelle cela le CGNAT) : il n'y a rien à rediriger, parce
qu'aucune adresse n'appartient en propre au restaurant. Même en s'acharnant sur l'interface du
routeur, cela ne marchera pas.

**La voie qui fonctionne est l'inverse.** Ce n'est pas le client qui entre : c'est le PC du
restaurant qui **sort**. Il ouvre lui-même une connexion vers un relais public et la garde ouverte.
Le relais, lui, possède une vraie adresse et un certificat. Quand un client demande cette adresse,
le relais fait redescendre la requête par la connexion déjà ouverte.

Une connexion sortante, tout réseau la laisse passer — c'est la même chose qu'ouvrir une page web.
Le partage d'adresse n'y change rien, et le routeur n'a pas à être configuré.

---

## Trois chemins, et ce qu'ils coûtent vraiment

| | Adresse obtenue | Coût | Tient dans le temps ? |
|---|---|---|---|
| **Tailscale Funnel** | `https://caisse-awa.<ton-réseau>.ts.net` | Gratuit | Oui — le nom est fixe |
| **Cloudflare Tunnel** | `https://chez-awa.tondomaine.bf` | Le domaine, 10–15 € / an | Oui |
| **`npm run partager`** | `https://<mots-au-hasard>.trycloudflare.com` | Gratuit | **Non** — change à chaque lancement |

Le troisième est un banc d'essai, pas une installation : l'adresse meurt avec la commande. Il sert
à montrer l'application à un client potentiel en deux minutes, jamais à faire tourner un restaurant.

### Tailscale Funnel — le chemin gratuit

Un compte personnel gratuit suffit. Le PC reçoit un nom stable en `.ts.net`, le certificat HTTPS est
fourni et renouvelé par Tailscale, et cela traverse le partage d'adresse sans configuration de
routeur.

Sur le PC du restaurant, une fois :

```
tailscale up
tailscale funnel 4000
```

Le débit est limité et non réglable — largement suffisant pour des commandes, qui sont quelques
kilo-octets de texte. Les photos des plats, elles, voyagent depuis l'hébergement de l'application,
pas depuis le PC.

Ce que ce chemin ne donne pas : une adresse à ton nom. `caisse-awa.tailnet-truc.ts.net` ne
s'imprime pas sur une affiche, et le service appartient à un tiers.

### Cloudflare Tunnel — le chemin à ton nom

Il demande **un nom de domaine à toi**, placé chez Cloudflare (le compte et le tunnel, eux, sont
gratuits). Chaque restaurant reçoit alors un sous-domaine : `chez-awa.tondomaine.bf`,
`resto-du-marche.tondomaine.bf`. C'est le chemin à prendre dès qu'il y a plus d'un client : une
adresse propre, qui reste la tienne si tu changes de méthode, et qui fait sérieux devant un
restaurateur.

---

## Les deux réglages à ne pas oublier

Une fois l'adresse obtenue, deux choses restent — et chacune produit une panne silencieuse si on
l'oublie. Silencieuse veut dire : l'application est vide, et **les journaux du serveur ne montrent
que des requêtes réussies.**

### 1. L'adresse publique doit être déclarée à l'API

```
PWA_ORIGINS=https://toncompte.github.io
```

L'application publique et l'API du restaurant vivent sur deux domaines différents. Le navigateur
n'autorise un tel appel que si l'API le dit explicitement. Sans cette ligne, l'API répond bien,
mais sans l'en-tête attendu — et le navigateur jette la réponse sans rien afficher.

Sur `github.io`, l'origine est celle du **compte**, pas du dépôt : l'autoriser autorise toutes les
pages publiées par ce compte. À savoir avant de la renseigner.

### 2. `https://` d'un côté oblige `https://` de l'autre

Une page servie en `https://` ne peut pas appeler une API en `http://`. Le navigateur refuse le
mélange, sans message visible et sans réglage possible. C'est la raison pour laquelle le lien
public de l'application **exige** que le serveur du restaurant ait lui aussi une adresse sécurisée
— et c'est exactement ce que le tunnel apporte.

Sur le Wi-Fi du restaurant, la question ne se pose pas : tout est en `http://`, des deux côtés.

---

## Ce que ça change pour l'équipe : rien

Le tunnel s'ajoute, il ne remplace rien. Les tablettes de la cuisine, la caisse et les téléphones
de l'équipe continuent de parler au PC par l'adresse locale — plus rapide, et **indépendante
d'Internet**.

| | Passe par | Marche sans Internet ? |
|---|---|---|
| Caisse, cuisine, tablettes, livreur sur place | `http://192.168.1.20:4000` | **Oui** |
| Client dans le restaurant, sur le Wi-Fi | `http://192.168.1.20:4000` | **Oui** |
| Client chez lui | le tunnel, en `https://` | Non |

**Si Internet tombe au restaurant, le service continue.** Seules les commandes à distance
s'arrêtent, et elles reprennent toutes seules au retour de la connexion. C'est une propriété du
montage, pas un hasard : c'est précisément pour cela que le serveur est le PC du restaurant et non
une machine louée ailleurs.

---

## Ce que je n'ai pas pu vérifier moi-même

Le conteneur où ce logiciel a été construit **n'accepte aucune connexion entrante** : un tunnel ne
peut pas y être essayé. Ce qui est vérifié, et ce qui ne l'est pas :

| | État |
|---|---|
| L'API accepte l'origine publiée, et refuse une autre adresse du même hébergeur | **Vérifié** — deux tests |
| L'application publiée fonctionne sous son sous-chemin, dans Safari et Chrome | **Vérifié** — 23 contrôles |
| Le refus du contenu mixte `https://` → `http://` | Règle du navigateur, non contournable |
| Le tunnel lui-même, de bout en bout | **Non vérifié ici** — à faire au premier déploiement |

Les commandes de cette page viennent de la documentation des deux services, pas d'un essai que
j'aurais fait. Le premier tunnel monté chez un vrai restaurant est le premier essai réel.

---

## Voir aussi

- [`vendre-et-installer.md`](vendre-et-installer.md) — ce que tu vends, et ce qui est gratuit
- [`deploiement.md`](deploiement.md) — l'autre montage : un VPS, un domaine, tout en ligne
- [`comment-ca-marche.md`](comment-ca-marche.md) — qui parle à qui, et par où

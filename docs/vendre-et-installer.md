# Vendre et installer Savora

Ce document répond à une question de commerçant, pas de développeur : **qu'est-ce que je vends
exactement, de quoi l'acheteur a besoin, et qu'est-ce que je tape où.**

---

## La chose la plus importante, en une phrase

> **Tu ne vends pas deux fichiers. Tu vends un service.**

L'APK et l'exe ne sont que des **fenêtres**. Ils ne contiennent aucun menu, aucun prix, aucune
commande, aucun client. Tout cela vit dans une troisième pièce — le **serveur** — et c'est elle qui
fait le produit.

```
   ┌──────────────┐        ┌─────────────────┐
   │  APK / PWA   │        │   exe Windows   │      ← ce que tu installes
   │  (le client) │        │   (l'équipe)    │         chez l'acheteur
   └──────┬───────┘        └────────┬────────┘
          │                         │
          └────────────┬────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   LE SERVEUR                 │          ← ce qu'il faut en plus,
        │   API + base de données      │             et que personne ne voit
        └──────────────────────────────┘
```

Envoyer l'APK et l'exe par WhatsApp ou sur une clé USB **fonctionne** : ce sont de vrais fichiers
installables. Mais installés sans serveur, ils s'ouvrent sur un écran qui demande une adresse, et
n'affichent rien. Ce n'est pas un défaut : c'est ce qu'ils sont.

---

## Est-ce que ça a besoin d'une connexion ?

**Oui — d'une connexion au serveur.** Ce n'est pas la même chose qu'Internet.

| Où est le serveur | Ce qu'il faut | Internet obligatoire ? |
|---|---|---|
| Un PC dans l'arrière-boutique du restaurant | Le Wi-Fi du restaurant | **Non** — sauf pour les clients qui commandent de chez eux |
| Un VPS (un serveur louté sur Internet) | Une connexion Internet | **Oui**, des deux côtés |

Ce qui continue de marcher sans réseau, du côté du client :

- le **menu** reste consultable : il a été mis en cache à la première visite ;
- le **panier** survit à la fermeture de l'application.

Ce qui ne marche pas sans réseau : **passer une commande.** C'est volontaire. Une commande acceptée
hors ligne serait une commande que la cuisine ne verra jamais, et un client qui attend un plat que
personne ne prépare.

Du côté de l'équipe, l'exe s'ouvre toujours — même serveur coupé — et affiche un écran d'erreur qui
dit ce qui se passe. Il ne reste pas blanc.

---

## Les trois façons de vendre, et ce qu'elles coûtent

> **À savoir avant de choisir :** aujourd'hui, **un serveur = un restaurant**. Le code prend le
> premier restaurant de sa base et travaille avec celui-là. Mettre plusieurs restaurants sur un seul
> serveur demande une modification du logiciel — elle est prévue et petite (une seule fonction à
> changer, [ADR 004](adr/)), mais elle n'est pas faite.

### A. Un serveur chez chaque restaurant

Un vieux PC ou un mini-serveur dans l'arrière-boutique. Le logiciel de caisse et les tablettes s'y
connectent par le Wi-Fi du restaurant.

| | |
|---|---|
| **Adresse à saisir** | L'IP fixe de ce PC, par exemple `192.168.1.20:4000` |
| **Internet** | Pas nécessaire pour le service sur place |
| **Ce que ça te coûte** | Rien par mois |
| **Ce que ça coûte au resto** | Le PC, une fois |
| **Le piège** | Tu ne vois pas la commission. Chaque mise à jour est une visite. Si le PC meurt, le restaurant est à l'arrêt, et c'est toi qu'on appelle. |
| **Les clients à distance** | Ne peuvent pas commander : le serveur n'est pas sur Internet |

### B. Un VPS par restaurant

Tu loues un petit serveur par client, avec un sous-domaine à toi.

| | |
|---|---|
| **Adresse à saisir** | `resto-du-client.tondomaine.bf` |
| **Ce que ça te coûte** | Un VPS par restaurant — ordre de grandeur 5 à 10 € par mois chacun, à vérifier chez ton hébergeur |
| **Ce que ça t'apporte** | Les commandes à distance, les mises à jour sans déplacement, la commission visible |
| **Le piège** | Autant de serveurs que de clients à surveiller |
| **Fonctionne aujourd'hui** | Oui, sans modifier le logiciel |

### C. Un seul VPS, tous les restaurants dessus

| | |
|---|---|
| **Adresse à saisir** | `resto-du-client.tondomaine.bf` pour chacun |
| **Ce que ça te coûte** | Un seul serveur pour tous |
| **Ce que ça t'apporte** | Le modèle le moins cher à exploiter, et celui qui rend la commission à 1 % naturelle |
| **Ce qu'il manque** | **La modification multi-restaurant.** Sans elle, tous les comptes tomberaient sur le même restaurant. |

**Ma recommandation :** commence en **B** avec ton premier client payant — ça marche aujourd'hui, sans
rien attendre. Passe en **C** au troisième ou quatrième client, quand la facture de serveurs commence
à se voir. N'emprunte **A** que pour un restaurant sans Internet fiable, en sachant ce que tu perds.

---

## Ce qu'il faut acheter, une fois

1. **Un nom de domaine.** Ordre de grandeur : 10 à 15 € par an. C'est lui qui permet le HTTPS, donc
   l'installation de l'application sur un iPhone, et une adresse qu'on imprime sur une affiche.
2. **Un VPS.** 2 Go de mémoire suffisent largement pour un fast-food. Ordre de grandeur 5 à 10 € par
   mois.

Le certificat HTTPS ne s'achète pas : le déploiement l'obtient et le renouvelle tout seul
([déploiement](deploiement.md)).

---

## Ce que tu tapes, et où

### Sur le serveur, une fois par restaurant

Les commandes de [`docs/deploiement.md`](deploiement.md). Elles se tapent **dans un terminal
connecté au VPS** (par SSH), pas sur ton PC.

### Dans l'exe et dans l'APK, chez l'acheteur

Un seul champ, au premier lancement : **l'adresse du serveur.** La même valeur dans les deux.

| Ton montage | Ce que tu saisis |
|---|---|
| VPS avec domaine | `resto-du-client.tondomaine.bf` |
| PC dans l'arrière-boutique | `192.168.1.20:4000` |

Sans `https://`, sans `/api`, sans barre oblique finale. Le logiciel complète : `https://` pour un nom
de domaine, `http://` pour une adresse IP locale — parce qu'un PC d'arrière-boutique n'a pas de
certificat et ne peut pas en avoir.

L'adresse n'est demandée **qu'une fois** : le logiciel s'en souvient. Elle se change ensuite sans
réinstaller.

---

## Essayer sur ta propre machine, avant de vendre

Ceci n'est **pas** ce que fait le restaurant. C'est un banc d'essai pour toi, sur ton PC, et il faut
installer deux outils de développeur.

### Une fois

| Outil | Pourquoi |
|---|---|
| [Node.js](https://nodejs.org) version 20 ou plus | Fait tourner le serveur et les interfaces |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Fait tourner PostgreSQL sans l'installer à la main |
| [Git](https://git-scm.com) | Récupère le code |

Puis, **dans un terminal ouvert dans le dossier du projet** — pas n'importe quel terminal :

```bash
git clone https://github.com/Stephane332/logiciel_app-resto.git
cd logiciel_app-resto
npm install
npm run db:up
npm run db:migrate
npm run db:seed
```

> Sur Windows, « terminal ouvert dans le dossier » veut dire : ouvrir le dossier dans l'explorateur,
> clic droit dans le vide, **Ouvrir dans le Terminal**. La ligne doit finir par `logiciel_app-resto>`
> avant que tu tapes quoi que ce soit.

### À chaque essai

```bash
npm run demarrer
```

La commande affiche l'adresse à saisir dans l'APK et l'exe, du genre `192.168.1.12:4000`. Ton
téléphone doit être sur **le même Wi-Fi**, et le pare-feu Windows doit autoriser le port 4000 — il le
demande au premier lancement, réponds *Autoriser*.

Comptes de démonstration : `70 00 00 01` à `70 00 00 05`, mot de passe `savora2026`.

---

## La liste avant une vente

- [ ] Le serveur tourne, et son adresse est notée
- [ ] Le restaurant a saisi **son** menu, ses prix, ses photos — le jeu de démonstration est effacé
- [ ] Ses horaires réels sont renseignés
- [ ] Ses secteurs de livraison et leurs forfaits sont saisis
- [ ] Son numéro marchand Mobile Money est saisi, et **vérifié par un vrai paiement de 100 F**
- [ ] Les mots de passe de démonstration sont changés
- [ ] Un compte par employé, avec son vrai nom — c'est ce qui permet de savoir qui a fait quoi
- [ ] L'équipe est formée à l'écran **Paiements à vérifier** : rien n'est encaissé sans attestation
- [ ] Les sauvegardes sont programmées, et une restauration a été essayée une fois

Le dernier point n'est pas une formalité. Une sauvegarde jamais restaurée n'est pas une sauvegarde,
et le jour où tu en auras besoin, ce sera devant un client.

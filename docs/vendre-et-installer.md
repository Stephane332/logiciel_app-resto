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

### A. Le PC de la caisse est le serveur  ·  *un seul fichier à installer*

Tu installes `Savora Pro` sur l'ordinateur de la caisse. **L'installateur porte tout** : la base de
données, le serveur, et le moteur qui le fait tourner. Il n'y a rien d'autre à installer sur ce PC.

Au premier lancement, le logiciel pose une seule question — **le rôle de cet ordinateur** :

- *« C'est la caisse principale du restaurant »* → le restaurateur saisit le nom de son restaurant,
  son téléphone et son mot de passe. En une trentaine de secondes, le serveur est debout, le
  restaurant créé, et le logiciel ouvert dessus. **Aucun plat de démonstration, aucun compte public**
  — son catalogue est vide, et c'est lui qui le remplit.
- *« C'est un poste secondaire »* → il saisit l'adresse de la caisse principale.

Les tablettes de cuisine et les téléphones du livreur saisissent cette même adresse.

| | |
|---|---|
| **Adresse à saisir sur les autres appareils** | L'IP du PC de la caisse, par exemple `192.168.1.20:4000` |
| **Internet** | Pas nécessaire pour le service sur place |
| **Ce que ça te coûte** | Rien par mois |
| **Ce que ça coûte au resto** | Le PC, une fois |
| **Le piège** | Tu ne vois pas la commission. Chaque mise à jour est une visite. Si le PC meurt, le restaurant est à l'arrêt, et c'est toi qu'on appelle. |
| **Les clients à distance** | Pas encore : un client chez lui ne peut pas joindre un PC posé sur le Wi-Fi d'un restaurant. Voir « La livraison depuis la maison » plus bas. |

> **Le poids du fichier.** L'installateur pèse plusieurs centaines de mégaoctets : il emporte
> PostgreSQL. C'est le prix d'un logiciel qui ne demande rien à installer. Par clé USB, aucun
> problème ; par WhatsApp, prévois du temps.

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

## La livraison depuis la maison

C'est la seule chose que le montage « tout chez le restaurant » ne donne pas encore, et il faut
comprendre pourquoi : **un client chez lui ne peut pas joindre un ordinateur posé sur le Wi-Fi d'un
restaurant.** C'est une règle des réseaux, pas un réglage.

La redirection de port sur le routeur ne suffit pas non plus : au Burkina, la plupart des
connexions n'ont pas d'adresse publique — plusieurs abonnés partagent la même, et rien ne peut être
redirigé vers l'un d'eux en particulier.

La voie qui fonctionne est l'inverse : **le PC du restaurant ouvre lui-même une connexion sortante**
vers un relais, et ce relais lui donne une adresse en HTTPS. Aucune configuration de routeur, aucune
adresse publique nécessaire, et cela traverse le partage d'adresse sans difficulté.

Il faut alors, une fois : **ton nom de domaine**. Chaque restaurant reçoit un sous-domaine —
`chez-awa.tondomaine.bf` — qui arrive sur son PC. Les clients commandent de partout, la PWA
s'installe sur iPhone, et tu ne paies aucun serveur.

Les limites, dites franchement : si le PC ou Internet du restaurant est coupé, les commandes à
distance s'arrêtent — mais **le service sur place continue**, parce que le Wi-Fi local suffit. Et le
relais dépend d'un tiers.

> **Le détail, avec les commandes exactes et les deux réglages qui produisent une panne silencieuse
> quand on les oublie : [`livraison-a-distance.md`](livraison-a-distance.md).** Il y a aussi un
> chemin entièrement gratuit, sans nom de domaine.

---

## Le lien public de l'application, gratuit

L'application cliente — celle que le client ouvre sur son téléphone — est un paquet de fichiers.
**Des fichiers s'hébergent gratuitement, en HTTPS, sur une adresse stable.** GitHub Pages le fait,
Netlify et Vercel aussi. Le workflow **PWA publique** y dépose l'application à chaque envoi de code.

Un seul geste, une seule fois, et seul le propriétaire du dépôt peut le faire :

> **[Ouvrir le réglage →](https://github.com/Stephane332/logiciel_app-resto/settings/pages)**
> puis *Build and deployment* → **Source** → **GitHub Actions**.
>
> Ensuite **[relancer la publication →](https://github.com/Stephane332/logiciel_app-resto/actions/workflows/pwa.yml)**
> (bouton **Run workflow**).

Le jeton d'un workflow ne porte jamais le droit d'administrer le dépôt : il sait publier sur Pages,
il ne sait pas créer le site. Aucun script ne peut donc faire ce clic.

L'adresse devient `https://<ton-compte>.github.io/<le-dépôt>/`. C'est un vrai lien HTTPS : il
s'ouvre sur n'importe quel téléphone, et **Safari sait l'installer sur l'écran d'accueil d'un
iPhone**. C'est la seule voie pour un client sur iPhone, et elle ne coûte rien.

**Ce que ce lien gratuit ne remplace pas.** Il sert l'application, pas les données. Les plats et les
commandes vivent dans l'API du restaurant, qu'un hébergeur de fichiers ne fait pas tourner. Et une
page servie en `https://` ne peut appeler qu'une API en `https://` — le navigateur refuse le
mélange, sans exception. L'application déposée là demande donc l'adresse du serveur au premier
lancement, et cette adresse doit être sécurisée.

D'où la distinction à garder en tête quand tu vends :

| | Payant ? | Ce que ça débloque |
|---|---|---|
| **Héberger la PWA** | Non | Un lien qu'on envoie, qui s'installe sur iPhone |
| **Une adresse HTTPS pour le serveur du restaurant** | Non, avec un sous-domaine gratuit type DuckDNS | Les commandes à distance, depuis la maison |
| **Ton propre nom de domaine** | 10 à 15 € par an | Une adresse à toi, qu'on imprime sur une affiche, et qui ne dépend pas d'un tiers |

---

## Qui installe quoi — la question qu'on te posera en premier

Un seul logiciel, une seule adresse. **Ce que chacun voit dépend de son compte, pas de ce qu'il a
installé.**

| Qui | Sur quoi | Ce qu'il installe | Ce qu'il voit |
|---|---|---|---|
| **La caisse** | le PC du restaurant | l'exe — c'est lui le serveur | tout : caisse, commandes, menu, statistiques |
| **La cuisine** | une tablette | **rien** — l'adresse du PC dans le navigateur | la file des commandes, et rien d'autre |
| **Le livreur** | son propre téléphone | **rien** — la même adresse | « Ma tournée », et rien d'autre |
| **Le client** | son téléphone | l'APK, ou le lien public | le menu et ses commandes |

L'équipe tape donc **une seule chose**, celle que le PC affiche à l'installation :

```
192.168.1.12:4000
```

Puis chacun se connecte avec son numéro et son mot de passe. Le livreur n'a accès ni à la caisse, ni
aux statistiques, ni au chiffre d'affaires — c'est vérifié à chaque livraison du logiciel, rôle par
rôle.

**Pour ne pas retaper l'adresse chaque jour :** une fois la page ouverte, Safari → Partager → « Sur
l'écran d'accueil », ou Chrome → menu → « Ajouter à l'écran d'accueil ». Le logiciel devient une
icône, et s'ouvre en plein écran. C'est ce qui change tout pour un livreur qui a les mains prises.

> **L'APK n'est pas pour l'équipe.** C'est l'application des clients qui commandent. Donner l'APK à
> un livreur ne lui ouvrira jamais sa tournée.

---

## Les données, et ce qui les protège

Tout vit sur le PC du restaurant : les commandes, le menu, les photos, les comptes de l'équipe, les
écritures de commission. C'est ce qui rend le montage simple et indépendant — et c'est aussi ce qui
le rend fragile si personne n'y pense.

**Le logiciel sauvegarde tout seul.** Une copie par jour, au démarrage, dans :

```
Documents\Savora\sauvegardes
```

Les quatorze dernières sont conservées ; les plus anciennes s'effacent. Un fichier texte à côté
explique quoi en faire. L'adresse du dossier est affichée à l'installation, sur le même écran que
l'adresse réseau.

> **Dis-le au restaurateur, et insiste :** ces copies sont sur **le même disque**. Elles le
> protègent d'une base abîmée ou d'une fausse manœuvre — pas d'un disque mort, d'un vol ou d'un
> incendie. **Une clé USB, une fois par semaine**, et le dossier copié dessus. C'est une minute, et
> c'est la différence entre un incident et la fin d'un commerce.

Vends-le comme tel : ce n'est pas une contrainte, c'est la seule chose qui garantit qu'un an de
chiffre d'affaires ne disparaît pas avec un disque dur.

---

## Ce qu'il faut acheter, une fois

Rien n'est obligatoire pour commencer : le logiciel tourne sur le PC du restaurant, l'équipe s'y
connecte par le Wi-Fi, et la PWA s'héberge gratuitement. Ce qui suit achète du confort et de
l'indépendance, pas le fonctionnement.

1. **Un nom de domaine.** Ordre de grandeur : 10 à 15 € par an. Un sous-domaine gratuit fait le même
   travail technique ; le domaine payant, lui, t'appartient — on l'imprime sur une affiche, il ne
   disparaît pas si le service gratuit ferme, et il fait sérieux devant un restaurateur.
2. **Un VPS.** 2 Go de mémoire suffisent largement pour un fast-food. Ordre de grandeur 5 à 10 € par
   mois. Inutile si le serveur est le PC du restaurant.

Le certificat HTTPS ne s'achète jamais : le déploiement l'obtient et le renouvelle tout seul
([déploiement](deploiement.md)).

---

## Ce que tu tapes, et où

### Sur le serveur, une fois par restaurant

Les commandes de [`docs/deploiement.md`](deploiement.md). Elles se tapent **dans un terminal
connecté au VPS** (par SSH), pas sur ton PC.

### Dans l'exe, sur le PC de la caisse

Rien à taper comme adresse : tu choisis **« C'est la caisse principale du restaurant »**, puis tu
saisis le nom du restaurant, le téléphone et le mot de passe du restaurateur. Le logiciel fait le
reste.

Note l'adresse que le PC affiche ensuite — c'est elle qu'il faut sur tous les autres appareils.

### Dans l'exe des postes secondaires, et dans l'APK

Un seul champ, au premier lancement : **l'adresse du serveur.** La même valeur partout.

| Ton montage | Ce que tu saisis |
|---|---|
| Le PC de la caisse est le serveur | `192.168.1.20:4000` (l'IP de ce PC) |
| VPS avec domaine | `resto-du-client.tondomaine.bf` |

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

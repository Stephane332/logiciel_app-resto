# Déploiement

Trois briques à mettre en ligne : l'**API**, l'**application cliente** et le **logiciel restaurant**.
Un VPS modeste suffit — 2 Go de mémoire vive tiennent largement la charge d'un fast-food.

---

## Avant de commencer

| Élément | Nécessaire pour |
|---|---|
| Un VPS Linux avec Docker | Héberger les trois briques |
| Un nom de domaine | Les QR Codes de table, et l'installation de la PWA |
| Un numéro marchand Orange Money ou Moov Money | Encaisser en Mobile Money — **aucun agrégateur n'est nécessaire** ([ADR 008](adr/008-paiement-declare-atteste.md)) |

**Le certificat TLS n'est plus à votre charge.** Caddy l'obtient au premier démarrage et le
renouvelle ensuite tout seul. C'est la dernière marche du déploiement, et c'était celle sur laquelle
tout s'arrêtait : les trois produits étaient construits, testés et installables, mais il n'existait
aucune adresse à ouvrir.

### Deux noms, dérivés d'un seul

Une seule valeur décide de tout : `DOMAINE`. Avec `DOMAINE=monresto.bf` :

| Adresse | Sert | Qui l'ouvre |
|---|---|---|
| `https://monresto.bf` | Application cliente (PWA installable) | Les clients |
| `https://pro.monresto.bf` | Logiciel restaurant | L'équipe |

**L'API n'a pas de sous-domaine** : chaque interface la sert sous son propre nom, en `/api`. Ce choix
supprime d'un coup le CORS à régler, l'adresse d'API à figer à la construction, et la ressaisie de
trois valeurs le jour d'un changement de domaine. Une adresse relative ne peut pas devenir fausse.

Avant de lancer quoi que ce soit : les **deux** noms doivent pointer sur l'IP du serveur — un
enregistrement `A` chacun, `monresto.bf` et `pro.monresto.bf` — et les ports **80 et 443** être
ouverts. Let's Encrypt vérifie le domaine par le port 80 ; fermé, aucun certificat ne sera délivré.

---

## Mise en ligne

```bash
git clone <dépôt> && cd logiciel_app-resto

cp infra/.env.prod.example infra/.env.prod
# Renseignez chaque valeur. Pour les secrets : openssl rand -base64 48

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

Puis appliquez les migrations et créez le premier restaurant :

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
  exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
  exec api npx tsx apps/api/prisma/seed.ts
```

> **Changez immédiatement le mot de passe des comptes créés par l'amorçage.** Ils sont publics : ils
> figurent dans le code source du dépôt.

Aucune des briques n'est exposée sur l'hôte : seul Caddy écoute sur 80 et 443, et atteint les autres
par le réseau interne de Compose. Les certificats vivent dans un volume — sans lui, chaque
redéploiement en redemanderait de nouveaux à Let's Encrypt, qui limite le nombre de demandes par
semaine et par domaine, et quelques mises à jour suffiraient à se retrouver sans certificat pendant
des jours.

Suivre l'obtention du premier certificat :

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod logs -f caddy
# certificate obtained successfully  →  les deux adresses sont en service
```

---

## Vérifier que tout fonctionne

```bash
curl https://monresto.bf/api/v1/../health   # ou, depuis le serveur :
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod exec api wget -qO- localhost:4000/health
# {"status":"ok","env":"production",...}
```

Puis, dans un navigateur :

1. Ouvrir `https://pro.monresto.bf`, se connecter, terminer l'assistant de configuration.
2. Y ajouter un plat avec sa photo — c'est le logiciel qui pilote l'application cliente.
3. Ouvrir `https://monresto.bf` : le plat doit y être. Passer une commande de retrait.
4. Vérifier qu'elle apparaît **immédiatement** côté restaurant, avec son alerte sonore.
5. Scanner un QR Code de table depuis un téléphone : le menu doit s'ouvrir sans installation.
6. Couper les données mobiles, recharger : le menu doit rester consultable.
7. Dans Chrome Android, menu ⋮ : **« Installer l'application »** doit être proposé. Si l'entrée
   n'apparaît pas, c'est que le certificat n'est pas en place — rien d'autre ne provoque cela.

Enfin, depuis un poste de développement branché sur ce serveur, tout se rejoue d'un coup :

```bash
API_URL=https://monresto.bf/api/v1 CLIENT_URL=https://monresto.bf RESTO_URL=https://pro.monresto.bf \
  node scripts/verifier-parcours.mjs
```

---

## Sauvegardes

```bash
mkdir -p infra/backups
crontab -e
# 0 3 * * * /chemin/vers/logiciel_app-resto/infra/backup.sh >> /var/log/savora-backup.log 2>&1
```

Restauration :

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
  exec -T db pg_restore -U savora -d savora --clean --if-exists < infra/backups/savora_AAAA-MM-JJ_HHMM.dump

# Puis les photos, sans lesquelles le catalogue reviendrait sans aucune image :
gunzip -c infra/backups/photos_AAAA-MM-JJ_HHMM.tar.gz | docker compose -f infra/docker-compose.prod.yml \
  exec -T api tar -xf - -C /data
```

> **Une sauvegarde jamais restaurée n'est pas une sauvegarde.** Testez la restauration une fois par
> trimestre, sur une base jetable. Copiez aussi les fichiers hors du serveur : un VPS qui disparaît
> emporte ses volumes.

---

## Mettre à jour

```bash
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
  exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Les clients reçoivent la nouvelle version au prochain chargement : le service worker la télécharge en
arrière-plan et l'active. Aucune réinstallation, aucun passage par un magasin d'applications.

---

## Mettre en service le Mobile Money

**Il n'y a pas d'agrégateur à contractualiser.** Une version antérieure de ce document l'affirmait ;
c'était faux, et cela retardait le seul moyen de paiement réellement utilisé par la clientèle. Orange
Money et Moov Money fonctionnent par code USSD, et la preuve du paiement est faite par le restaurant
lui-même, sur le SMS reçu sur son propre téléphone ([ADR 008](adr/008-paiement-declare-atteste.md)).

Il suffit donc du numéro marchand :

1. Vérifier que `PAYMENT_PROVIDER=declared` dans `infra/.env.prod` — c'est le défaut.
2. Dans le logiciel restaurant, **Paramètres → Mobile Money**, saisir le ou les numéros marchands et
   activer les moyens correspondants.
3. C'est tout. Un moyen de paiement n'apparaît au client que si son numéro est renseigné : il est donc
   impossible de proposer un code USSD qui n'aboutirait nulle part.

Former l'équipe à l'écran **Paiements à vérifier** : c'est là que se fait l'attestation, et rien n'est
encaissé tant qu'elle n'a pas eu lieu. La règle tient en une phrase, et elle mérite d'être affichée au
comptoir :

> Celui qui paie ne confirme jamais son propre paiement.

### Le jour où un agrégateur devient justifié

Quand le volume rend la vérification manuelle pesante, l'automatisation se branche sans rien défaire
(voir [ADR 007](adr/007-paiement-adaptateurs.md)) :

1. Écrire `apps/api/src/payments/<agregateur>.ts` en implémentant l'interface `PaymentProvider`.
2. L'enregistrer dans `apps/api/src/payments/index.ts`.
3. Renseigner `PAYMENT_PROVIDER` et `PAYMENT_WEBHOOK_SECRET` dans `infra/.env.prod`.
4. Déclarer l'URL de webhook chez l'agrégateur :
   `https://monresto.bf/api/v1/payments/webhook/<agregateur>`.

Rien d'autre ne bouge : le reste du système ignore quel fournisseur encaisse.

---

## Avant l'ouverture au public

- [ ] Mots de passe de l'amorçage changés
- [ ] `JWT_SECRET` et `PAYMENT_WEBHOOK_SECRET` réellement aléatoires
- [ ] HTTPS actif sur les deux adresses, et « Installer l’application » proposé par Chrome Android
- [ ] Menu, prix et photos réels saisis par le restaurant
- [ ] Horaires réels renseignés
- [ ] Zones de livraison réelles et leurs forfaits
- [ ] Numéros marchands Mobile Money saisis et vérifiés par un paiement réel de 100 F
- [ ] Équipe formée à l'écran « Paiements à vérifier »
- [ ] `PLATFORM_MOMO_NUMBER` renseigné — le serveur refuse de démarrer sans, en production
- [ ] `UPLOAD_DIR` monté sur un **volume persistant** — stocké dans le conteneur, tout le catalogue
      photographique du restaurant disparaîtrait au premier redéploiement
- [ ] Le dossier des photos est inclus dans la sauvegarde quotidienne (la base seule ne suffit pas :
      elle ne contient que les adresses des images, pas les images)
- [ ] Taux de commission confirmé avec le restaurant, par écrit, avant la première facturation
- [ ] QR Codes imprimés et collés sur les tables
- [ ] Comptes créés pour chaque employé, avec le bon rôle
- [ ] Sauvegarde planifiée **et restauration testée**
- [ ] Traitement déclaré à la CIL (§ 15.4 du cahier des charges)
- [ ] Pilote mené avec le personnel avant l'ouverture au public

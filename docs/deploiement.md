# Déploiement

Trois briques à mettre en ligne : l'**API**, l'**application cliente** et le **logiciel restaurant**.
Un VPS modeste suffit — 2 Go de mémoire vive tiennent largement la charge d'un fast-food.

---

## Avant de commencer

| Élément | Nécessaire pour |
|---|---|
| Un VPS Linux avec Docker | Héberger les trois briques |
| Un nom de domaine | Les QR Codes de table et l'installation de la PWA |
| Un certificat TLS | Obligatoire : sans HTTPS, ni service worker ni PWA installable |
| Un compte marchand Mobile Money | Le paiement en ligne réel (facultatif au lancement) |

Trois sous-domaines suffisent, par exemple :

| Sous-domaine | Sert |
|---|---|
| `app.exemple.bf` | Application cliente (PWA) |
| `resto.exemple.bf` | Logiciel restaurant |
| `api.exemple.bf` | API et temps réel |

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

Les trois services écoutent sur la boucle locale (`127.0.0.1:4000`, `:8080`, `:8081`). Il reste à
placer devant eux un reverse proxy qui termine le TLS.

### Exemple avec Caddy

Caddy obtient et renouvelle les certificats tout seul, ce qui évite une tâche planifiée de plus.

```caddyfile
app.exemple.bf {
    reverse_proxy 127.0.0.1:8080
}

resto.exemple.bf {
    reverse_proxy 127.0.0.1:8081
}

api.exemple.bf {
    # Le temps réel passe par la même origine : Caddy relaie WebSocket sans configuration
    # supplémentaire.
    reverse_proxy 127.0.0.1:4000
}
```

---

## Vérifier que tout fonctionne

```bash
curl https://api.exemple.bf/health
# {"status":"ok","env":"production",...}
```

Puis, dans un navigateur :

1. Ouvrir `https://resto.exemple.bf`, se connecter, terminer l'assistant de configuration.
2. Ouvrir `https://app.exemple.bf`, passer une commande de retrait.
3. Vérifier qu'elle apparaît **immédiatement** dans le logiciel restaurant, avec son alerte sonore.
4. Scanner un QR Code de table depuis un téléphone : le menu doit s'ouvrir sans installation.
5. Couper les données mobiles, recharger : le menu doit rester consultable.

---

## Sauvegardes

```bash
mkdir -p infra/backups
crontab -e
# 0 3 * * * /chemin/vers/logiciel_app-resto/infra/backup.sh >> /var/log/barabite-backup.log 2>&1
```

Restauration :

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
  exec -T db pg_restore -U barabite -d barabite --clean --if-exists < infra/backups/barabite_AAAA-MM-JJ_HHMM.dump
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

## Brancher le Mobile Money

L'architecture attend un agrégateur (voir [ADR 007](adr/007-paiement-adaptateurs.md)). Une fois le
compte marchand ouvert :

1. Écrire `apps/api/src/payments/<agregateur>.ts` en implémentant l'interface `PaymentProvider`.
2. L'enregistrer dans `apps/api/src/payments/index.ts`.
3. Renseigner `PAYMENT_PROVIDER` et `PAYMENT_WEBHOOK_SECRET` dans `infra/.env.prod`.
4. Déclarer l'URL de webhook chez l'agrégateur :
   `https://api.exemple.bf/api/v1/payments/webhook/<agregateur>`.

Rien d'autre ne bouge : le reste du système ignore quel fournisseur encaisse.

---

## Avant l'ouverture au public

- [ ] Mots de passe de l'amorçage changés
- [ ] `JWT_SECRET` et `PAYMENT_WEBHOOK_SECRET` réellement aléatoires
- [ ] HTTPS actif sur les trois sous-domaines
- [ ] Menu, prix et photos réels saisis par le restaurant
- [ ] Horaires réels renseignés
- [ ] Zones de livraison réelles et leurs forfaits
- [ ] QR Codes imprimés et collés sur les tables
- [ ] Comptes créés pour chaque employé, avec le bon rôle
- [ ] Sauvegarde planifiée **et restauration testée**
- [ ] Traitement déclaré à la CIL (§ 15.4 du cahier des charges)
- [ ] Pilote mené avec le personnel avant l'ouverture au public

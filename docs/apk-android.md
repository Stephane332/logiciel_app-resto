# Construire et installer l'APK Android

L'application Android est **la même application que la PWA**, empaquetée par Capacitor. Un seul code
source, deux canaux de diffusion (voir [ADR 001](adr/001-pwa-avant-natif.md)).

> **Rien à installer sur votre poste.** L'APK se construit dans GitHub Actions : ni Android Studio,
> ni SDK Android, ni JDK.

---

## Obtenir un APK

1. Sur GitHub, ouvrez **Actions → APK Android → Run workflow**.
2. Renseignez éventuellement l'URL de l'API (sinon la variable de dépôt `API_URL` est utilisée).
3. Au bout de quelques minutes, téléchargez l'artefact **`savora-apk`**.
4. Transférez le fichier `.apk` sur un téléphone Android et ouvrez-le.
   Android demandera d'autoriser l'installation depuis cette source : c'est normal pour un APK
   distribué hors magasin.

L'APK produit par défaut est une **version de débogage** : installable immédiatement, sans certificat.
Elle suffit pour tester, faire tester au personnel et mener le pilote.

---

## Configurer l'URL de l'API

L'APK n'a pas de « même domaine » : contrairement à la PWA, il ne peut pas appeler `/api/v1` en
relatif. L'URL doit donc être **absolue** et connue au moment de la construction.

Dans **Settings → Secrets and variables → Actions → Variables** :

| Variable | Exemple | Rôle |
|---|---|---|
| `API_URL` | `https://api.exemple.bf/api/v1` | Point d'entrée de l'API |
| `REALTIME_URL` | `https://api.exemple.bf` | Serveur temps réel (suivi de commande) |

Sans ces valeurs, l'APK se construit mais ne trouvera aucun serveur.

---

## Publier une version signée

Nécessaire seulement pour le Play Store, ou pour livrer des mises à jour qui s'installent par-dessus
la précédente.

### 1. Créer un magasin de clés

```bash
keytool -genkey -v -keystore savora.keystore \
  -alias savora -keyalg RSA -keysize 2048 -validity 10000
```

> **Conservez ce fichier et ses mots de passe.** Les perdre signifie ne plus jamais pouvoir mettre à
> jour l'application publiée : Android refusera toute version signée par une autre clé. Sauvegardez-le
> hors du dépôt, en lieu sûr.

### 2. Enregistrer les secrets

Dans **Settings → Secrets and variables → Actions → Secrets** :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 savora.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du magasin |
| `ANDROID_KEY_ALIAS` | `savora` |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Le magasin de clés n'est **jamais** commis dans le dépôt : qui le lit peut publier une mise à jour au
nom du restaurant.

### 3. Relancer le workflow

L'artefact **`savora-apk-signe`** apparaît en plus de la version de débogage.

---

## Liens profonds du QR de table

Pour qu'un QR Code de table scanné ouvre l'application installée plutôt que le navigateur :

1. Remplacez `deep_link_host` dans `apps/client/android/app/src/main/res/values/strings.xml` par le
   domaine réel.
2. Publiez `/.well-known/assetlinks.json` sur ce domaine, avec l'empreinte SHA-256 de votre clé de
   signature :

```bash
keytool -list -v -keystore savora.keystore -alias savora | grep SHA256
```

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.savora.client",
      "sha256_cert_fingerprints": ["VOTRE:EMPREINTE:SHA256"]
    }
  }
]
```

Sans ce fichier, Android proposera un choix d'application au lieu d'ouvrir directement la vôtre.
**Ce n'est pas bloquant** : un client qui n'a pas installé l'application ouvre la même URL dans son
navigateur et commande quand même. C'est précisément pourquoi la PWA est le canal principal.

---

## Construire localement

Utile seulement pour déboguer le comportement natif.

```bash
cd apps/client
npm run build
npx cap sync android
npx cap open android          # ouvre Android Studio
# ou, en ligne de commande, avec le SDK installé :
cd android && ./gradlew assembleDebug
```

L'APK se trouve dans `apps/client/android/app/build/outputs/apk/debug/`.

## Regénérer les icônes

Après un changement de logo :

```bash
cd apps/client
npm i -D sharp
node scripts/generate-icons.mjs           # icônes PWA
node scripts/generate-android-assets.mjs  # icônes et écrans de lancement Android
```

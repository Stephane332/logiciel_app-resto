# 001 — PWA d'abord, APK ensuite, natif jamais obligatoire

**Statut :** acceptée — Septembre 2026

## Contexte
Le cahier des charges V2.0 recommandait Flutter, avec React Native en second choix. Le projet a ensuite
exigé une **application installable en PWA d'abord, puis un APK**. Le client est un fast-food de
Ouahigouya dont l'audience existe déjà sur TikTok et Facebook.

## Décision
L'application cliente est une **PWA React + Vite + TypeScript**, empaquetée en **APK par Capacitor**,
compilé par GitHub Actions.

## Justification
1. **Le QR de table est une URL.** Un client qui scanne la table doit voir le menu immédiatement, sans
   installer quoi que ce soit. C'est la fonction qui décide de l'adoption ; elle interdit une application
   uniquement native.
2. **Diffusion sociale.** Un lien de menu se partage dans une story TikTok ou une publication Facebook.
   Un APK ne se partage pas ainsi.
3. **Poids.** `react-native-web` produit environ 1 Mo de JavaScript, React/Vite environ 200 Ko compressés.
   Sur des données mobiles payées au mégaoctet, ce n'est pas du confort, c'est du taux d'abandon.
4. **Un seul écosystème.** Le logiciel restaurant est du React web de toute façon ; design system, couche
   de données et outillage sont mutualisés.

## Conséquences
- Les notifications push iOS restent limitées. Acceptable : le marché visé est massivement Android.
- Un passage ultérieur au natif reste ouvert : les règles métier vivent dans `packages/shared`.

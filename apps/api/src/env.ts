/**
 * Configuration d'exécution.
 *
 * Validée au démarrage : un serveur qui démarre avec une configuration incomplète tombe plus tard,
 * en production, au pire moment. Mieux vaut refuser de démarrer.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis.'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit faire au moins 16 caractères.'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  /**
   * Nom d'hôte déclaré par l'application mobile (`server.hostname` de capacitor.config.ts).
   *
   * Il doit correspondre : c'est l'origine que l'APK présente à chaque requête, et une valeur
   * différente ici suffit à rendre l'application muette sans qu'aucun journal ne l'indique.
   */
  MOBILE_HOSTNAME: z.string().default('app.savora.bf'),
  PUBLIC_CLIENT_URL: z.string().default('http://localhost:5173'),
  PAYMENT_PROVIDER: z.enum(['declared', 'sandbox', 'cinetpay', 'ligdicash']).default('declared'),
  PAYMENT_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),

  // --- Plateforme (commission, ADR 009) ---------------------------------------------------------
  /// Nom affiché sur le relevé du restaurant.
  PLATFORM_NAME: z.string().default('Savora'),
  /// Numéro qui reçoit le reversement de la commission.
  PLATFORM_MOMO_NUMBER: z.string().default(''),
  PLATFORM_MOMO_OPERATOR: z.enum(['ORANGE_MONEY', 'MOOV_MONEY']).default('ORANGE_MONEY'),
  /**
   * Modèle USSD du reversement de la commission.
   *
   * Le défaut portait `*144*2*1*…`, le code d'un **transfert** entre particuliers. Or le reversement
   * se fait sur le numéro marchand de la plateforme, et son code est `*144*10*…` — le même que celui
   * qu'un client utilise pour payer un restaurant. Les deux codes se ressemblent et n'aboutissent pas
   * au même endroit : le restaurant aurait composé un transfert là où un paiement marchand était
   * attendu.
   *
   * Réglable, parce qu'un code d'opérateur change sans prévenir.
   */
  PLATFORM_MOMO_USSD: z.string().default('*144*10*{NUM}*{MONTANT}#'),

  /// Dossier des photos envoyées par le restaurant. Doit être un volume persistant en production :
  /// stocké dans le conteneur, le catalogue photographique disparaîtrait au premier redéploiement.
  /**
   * Où atterrissent les photos des plats. Chemin **relatif au dossier de lancement** de l'API : en
   * production, donnez-lui un chemin absolu monté sur un volume, sinon les photos disparaissent avec
   * le conteneur — et un catalogue d'images cassées est pire qu'un catalogue sans images.
   */
  UPLOAD_DIR: z.string().default('./uploads'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')} : ${i.message}`).join('\n');
  throw new Error(`Configuration invalide :\n${details}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Origines de l'application installée sur un téléphone.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une application installée n'a pas l'origine du serveur. Elle a la sienne.    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Sur le web, l'application et son API partagent le domaine : aucune requête ne franchit d'origine,
 * et le CORS ne se pose pas. Installée en APK, elle est servie par le téléphone lui-même, sous
 * l'origine que déclare Capacitor — `https://app.savora.bf` par défaut. Chaque appel d'API devient
 * donc une requête entre origines.
 *
 * Elle n'était autorisée nulle part. L'API répondait 200 sans en-tête `Access-Control-Allow-Origin`,
 * et le navigateur embarqué jetait la réponse : l'APK s'installait, s'ouvrait, et restait vide. Le
 * défaut est invisible côté serveur — les journaux ne montrent que des requêtes réussies.
 *
 * Ces origines sont donc admises en plus des domaines configurés. Elles sont nommées une par une :
 * on n'ouvre pas le CORS en grand pour faire marcher une application.
 */
export const mobileOrigins = [
  // L'origine déclarée par Capacitor (`server.hostname` dans capacitor.config.ts).
  `https://${env.MOBILE_HOSTNAME}`,
  // Les schémas propres à Capacitor et Ionic, selon la version et la plate-forme.
  'capacitor://localhost',
  'ionic://localhost',
  // Android en schéma http, et iOS via WKWebView.
  'http://localhost',
  'https://localhost',
];

/**
 * Toutes les origines admises.
 *
 * En développement, on accepte en plus les adresses du réseau local : c'est depuis un téléphone du
 * même Wi-Fi qu'on essaie l'application, et refuser cette origine rendrait tout essai impossible
 * avant l'hébergement. La tolérance s'arrête à la production, où seules les origines nommées
 * passent.
 */
export function originAutorisee(origine: string | undefined): boolean {
  // Pas d'origine : requête directe (curl, application à application). Le CORS ne la concerne pas.
  if (!origine) return true;
  if (corsOrigins.includes(origine) || mobileOrigins.includes(origine)) return true;

  if (!isProduction) {
    // Plages privées uniquement : 192.168.x.x, 10.x.x.x, 172.16–31.x.x, et la boucle locale.
    return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
      origine,
    );
  }

  return false;
}

if (isProduction && env.JWT_SECRET.startsWith('dev-')) {
  throw new Error('JWT_SECRET de développement détecté en production. Générez-en un vrai.');
}

/**
 * Le logiciel tourne-t-il **chez** le restaurant, embarqué dans l'application installée ?
 *
 * La distinction n'est pas cosmétique : elle décide de ce qu'on fait d'une configuration incomplète.
 */
export const estEmbarque = process.env.SAVORA_EMBARQUE === '1';

/*
 * Un relevé de commission sans numéro de reversement indique au restaurant une somme à payer sans
 * lui dire où l'envoyer. Il faut donc le signaler — mais pas de la même façon selon l'endroit.
 *
 * **Sur un serveur hébergé**, l'arrêt immédiat est le bon comportement : celui qui déploie voit
 * l'erreur dans la seconde, aucun restaurant n'est concerné, et le défaut se corrige avant d'exister.
 *
 * **Dans le logiciel installé sur la caisse d'un restaurant**, l'arrêt serait une faute grave. Le
 * réglage manquant appartient à la plateforme, pas au restaurant : le restaurateur n'y peut rien, et
 * il découvrirait une caisse qui refuse de s'ouvrir un midi de service. La disproportion est totale —
 * un relevé imprécis contre un restaurant à l'arrêt.
 *
 * On avertit donc bruyamment dans les journaux, et le logiciel démarre.
 */
if (isProduction && !env.PLATFORM_MOMO_NUMBER) {
  const message =
    'PLATFORM_MOMO_NUMBER est vide : le restaurant verrait sa commission due sans savoir où la reverser.';
  if (estEmbarque) {
    console.warn(`[savora] ${message} Le reversement devra être communiqué autrement.`);
  } else {
    throw new Error(message);
  }
}

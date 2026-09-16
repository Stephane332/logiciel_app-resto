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
  PUBLIC_CLIENT_URL: z.string().default('http://localhost:5173'),
  PAYMENT_PROVIDER: z.enum(['declared', 'sandbox', 'cinetpay', 'ligdicash']).default('declared'),
  PAYMENT_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),

  // --- Plateforme (commission, ADR 009) ---------------------------------------------------------
  /// Nom affiché sur le relevé du restaurant.
  PLATFORM_NAME: z.string().default('BaraBite'),
  /// Numéro qui reçoit le reversement de la commission.
  PLATFORM_MOMO_NUMBER: z.string().default(''),
  PLATFORM_MOMO_OPERATOR: z.enum(['ORANGE_MONEY', 'MOOV_MONEY']).default('ORANGE_MONEY'),
  /// Modèle USSD du transfert. Réglable, parce qu'un code d'opérateur change sans prévenir.
  PLATFORM_MOMO_USSD: z.string().default('*144*2*1*{NUM}*{MONTANT}#'),
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

if (isProduction && env.JWT_SECRET.startsWith('dev-')) {
  throw new Error('JWT_SECRET de développement détecté en production. Générez-en un vrai.');
}

// Un relevé de commission sans numéro de reversement indique au restaurant une somme à payer sans
// lui dire où l'envoyer. Mieux vaut le savoir au démarrage qu'à la première fin de mois.
if (isProduction && !env.PLATFORM_MOMO_NUMBER) {
  throw new Error(
    "PLATFORM_MOMO_NUMBER est vide : le restaurant verrait sa commission due sans savoir où la reverser.",
  );
}

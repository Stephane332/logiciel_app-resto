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
  PAYMENT_PROVIDER: z.enum(['sandbox', 'cinetpay', 'ligdicash']).default('sandbox'),
  PAYMENT_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),
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

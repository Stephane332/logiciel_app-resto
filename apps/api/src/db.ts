import { PrismaClient } from '@prisma/client';
import { env, isProduction } from './env.js';

export const prisma = new PrismaClient({
  log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  datasources: { db: { url: env.DATABASE_URL } },
});

export type Db = typeof prisma;

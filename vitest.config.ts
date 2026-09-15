import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/android/**'],
    environment: 'node',
    // Les tests d'intégration touchent une vraie base : une base dédiée, jamais celle de
    // développement, et jamais deux fichiers en parallèle sur les mêmes tables.
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgresql://barabite@127.0.0.1:5432/barabite_test',
      JWT_SECRET: 'secret-de-test-uniquement-pour-les-tests-automatises',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret',
      // Fixé explicitement : Prisma charge apps/api/.env au démarrage, et une valeur
      // laissée à un poste de développement rendrait ces tests dépendants de lui.
      PAYMENT_PROVIDER: 'declared',
      PUBLIC_CLIENT_URL: 'http://localhost:5173',
    },
  },
});

import { buildApp } from './app.js';
import { env } from './env.js';
import { prisma } from './db.js';
import { initRealtime } from './lib/realtime.js';

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  initRealtime(app.server);
  app.log.info(`Savora API — temps réel actif sur /realtime`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} reçu, arrêt propre`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

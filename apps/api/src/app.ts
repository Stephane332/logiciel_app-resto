import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { TransitionError, ForbiddenError, MoneyError, PricingError } from '@barabite/shared';
import { corsOrigins, env, isProduction, isTest } from './env.js';
import { AppError } from './lib/errors.js';
import { attachAuth } from './lib/guards.js';
import { registerRoutes } from './routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProduction
      ? { level: 'info' }
      : { level: 'info', transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } },
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: corsOrigins, credentials: true });

  // Limitation de débit globale. Les routes sensibles (authentification, création de commande,
  // webhooks) resserrent encore la limite localement.
  await app.register(rateLimit, {
    // Désactivé en test : des connexions répétées y sont normales, pas une attaque.
    max: isTest ? Number.MAX_SAFE_INTEGER : 300,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans un instant.' },
    }),
  });

  app.addHook('onRequest', attachAuth);

  app.setErrorHandler((error, request, reply) => {
    // Validation : on renvoie le détail champ par champ, c'est ce qui permet à l'interface
    // d'afficher l'erreur au bon endroit du formulaire.
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Certaines informations sont invalides.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    if (error instanceof TransitionError) {
      return reply.status(409).send({ error: { code: error.code, message: error.message } });
    }

    if (error instanceof ForbiddenError) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: error.message } });
    }

    if (error instanceof MoneyError || error instanceof PricingError) {
      return reply.status(400).send({ error: { code: 'INVALID_AMOUNT', message: error.message } });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply
          .status(409)
          .send({ error: { code: 'ALREADY_EXISTS', message: 'Cet élément existe déjà.' } });
      }
      if (error.code === 'P2025') {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
      }
    }

    // Erreurs Fastify (parsing, limite de taille, débit) : elles portent déjà un statut utilisable.
    const fastifyError = error as { statusCode?: number; code?: string; message?: string };
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? 'REQUEST_ERROR',
          message: fastifyError.message ?? 'Requête invalide.',
        },
      });
    }

    request.log.error({ err: error }, 'erreur non gérée');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        // Aucun détail interne n'est exposé : un message d'erreur bavard est une carte du système.
        message: 'Une erreur interne est survenue. Réessayez dans un instant.',
      },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route inconnue : ${request.method} ${request.url}` },
    }),
  );

  await registerRoutes(app);

  app.get('/health', async () => ({ status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() }));

  return app;
}

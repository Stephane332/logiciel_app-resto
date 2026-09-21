import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { TransitionError, ForbiddenError, MoneyError, PricingError } from '@savora/shared';
import { resolve, join } from 'node:path';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { env, isProduction, isTest, originAutorisee } from './env.js';
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
  /*
   * Le contrôle passe par une fonction plutôt qu'une liste : l'application installée sur un
   * téléphone a sa propre origine, et le réseau local doit rester essayable avant l'hébergement.
   * `originAutorisee` dit précisément qui entre, et pourquoi (voir env.ts).
   */
  await app.register(cors, {
    origin: (origine, rappel) => rappel(null, originAutorisee(origine ?? undefined)),
    credentials: true,
  });

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

  // Photos des produits : réception, puis service en lecture.
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

  const uploadRoot = resolve(env.UPLOAD_DIR);
  mkdirSync(uploadRoot, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadRoot,
    // Sous le préfixe de l'API, et non à la racine : les médias empruntent ainsi exactement le
    // chemin déjà emprunté par les requêtes d'API — même proxy en développement, même sous-domaine
    // en production. Servis à la racine, ils tombaient dans le repli SPA de l'interface, qui
    // renvoyait sa page HTML à la place de l'image, sans la moindre erreur pour le signaler.
    prefix: '/api/v1/media/',
    // Le nom du fichier contient l'empreinte de son contenu : une photo remplacée porte un autre
    // nom, donc l'ancienne peut être gardée indéfiniment. C'est ce qui rend le menu léger à la
    // deuxième visite, et consultable hors ligne.
    maxAge: '365d',
    immutable: true,
    index: false,
    // Les images sont servies à la PWA depuis une autre origine en développement.
    //
    // `setHeaders` reçoit la réponse **Fastify** depuis la version 10 du greffon, là où elle
    // recevait la réponse brute de Node. `res.setHeader` n'existe donc plus ici : c'est `header`.
    // Le compilateur l'a dit tout de suite ; sans typage, l'en-tête aurait disparu en silence et
    // les photos auraient cessé de s'afficher hors du domaine de l'API.
    setHeaders: (reponse) => reponse.header('Cross-Origin-Resource-Policy', 'cross-origin'),
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

  /*
   * L'interface du restaurant, servie par le serveur lui-même.
   *
   * ┌──────────────────────────────────────────────────────────────────────────────┐
   * │  La tablette de cuisine n'a pas d'autre porte d'entrée que celle-ci.          │
   * └──────────────────────────────────────────────────────────────────────────────┘
   *
   * Sur un VPS, Caddy s'en charge et `INTERFACE_DIR` reste vide. Chez un restaurant, le serveur est
   * le PC de la caisse : l'interface qu'il porte n'était servie que sur sa propre boucle locale,
   * donc visible dans la fenêtre du logiciel et nulle part ailleurs. Une tablette qui ouvrait
   * l'adresse annoncée à l'installation recevait `{"error":{"code":"NOT_FOUND"}}` — alors que cet
   * écran promet que la cuisine et les téléphones de l'équipe s'y connecteront.
   *
   * Tout tient désormais sur une seule adresse : l'interface à la racine, l'API sous `/api`. Même
   * origine, donc aucun CORS à régler et aucun contenu mixte possible ; et une seule chose à saisir
   * sur chaque appareil de l'équipe.
   */
  const interfaceDir = env.INTERFACE_DIR ? resolve(env.INTERFACE_DIR) : '';
  const interfaceServie = Boolean(interfaceDir) && existsSync(join(interfaceDir, 'index.html'));
  if (interfaceServie) {
    await app.register(fastifyStatic, {
      root: interfaceDir,
      prefix: '/',
      // Un second greffon statique ne redécore pas la réponse : la première inscription l'a fait.
      decorateReply: false,
      index: ['index.html'],
    });
  }

  app.setNotFoundHandler((request, reply) => {
    /*
     * Repli de l'application à page unique.
     *
     * « /cuisine » n'est pas un fichier : c'est une adresse que le routeur résout dans le
     * navigateur. Sans ce repli, ouvrir ou recharger une page autre que l'accueil renverrait
     * l'erreur JSON de l'API — une tablette de cuisine rechargée en plein service afficherait du
     * texte technique au lieu de sa file de commandes.
     *
     * Jamais pour `/api` : une route d'API inconnue doit rester une erreur d'API, sans quoi
     * l'application recevrait du HTML là où elle attend du JSON et échouerait sans rien dire.
     */
    if (interfaceServie && request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.type('text/html').send(readFileSync(join(interfaceDir, 'index.html')));
    }
    return reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route inconnue : ${request.method} ${request.url}` },
    });
  });

  await registerRoutes(app);

  app.get('/health', async () => ({ status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() }));

  return app;
}

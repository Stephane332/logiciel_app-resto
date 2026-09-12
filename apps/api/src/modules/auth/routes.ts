/**
 * Authentification.
 *
 * L'identité est le numéro de téléphone, pas l'adresse électronique : c'est l'identifiant réel des
 * personnes au Burkina Faso. Le mot de passe est optionnel pour un client — exiger une inscription
 * complète avant de commander fait perdre la majorité des visiteurs (§ 2.2).
 */
import type { FastifyInstance } from 'fastify';
import { loginSchema, parseBurkinaPhone, registerSchema } from '@barabite/shared';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { isTest } from '../../env.js';
import { currentRestaurantId } from '../../lib/context.js';
import { badRequest, conflict, unauthorized } from '../../lib/errors.js';
import {
  generateRefreshToken,
  hashPassword,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  verifyPassword,
} from '../../lib/auth.js';
import { requireAuth } from '../../lib/guards.js';

function publicUser(user: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  loyaltyPoints: number;
  marketingConsent: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
    marketingConsent: user.marketingConsent,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Limite resserrée : l'authentification est la porte d'entrée, donc la cible privilégiée.
  await app.register(async (scoped) => {
    await scoped.register(import('@fastify/rate-limit'), {
      max: isTest ? Number.MAX_SAFE_INTEGER : 10,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
    });

    scoped.post('/auth/register', async (request, reply) => {
      const body = registerSchema.parse(request.body);
      const restaurantId = await currentRestaurantId();
      const phone = parseBurkinaPhone(body.phone).e164!;

      const existing = await prisma.user.findUnique({
        where: { restaurantId_phone: { restaurantId, phone } },
      });

      if (existing) {
        // Un compte sans mot de passe a pu être créé automatiquement lors d'une commande invitée :
        // le client peut alors le réclamer en définissant son mot de passe, sans repartir de zéro.
        if (existing.passwordHash) {
          throw conflict('PHONE_TAKEN', 'Ce numéro est déjà inscrit. Connectez-vous.');
        }
        if (!body.password) {
          throw badRequest('PASSWORD_REQUIRED', 'Choisissez un mot de passe pour ce numéro.');
        }
        const claimed = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: body.name,
            email: body.email || null,
            passwordHash: await hashPassword(body.password),
          },
        });
        return reply.send(await issueSession(claimed));
      }

      const user = await prisma.user.create({
        data: {
          restaurantId,
          phone,
          name: body.name,
          email: body.email || null,
          passwordHash: body.password ? await hashPassword(body.password) : null,
          role: 'CLIENT',
        },
      });

      return reply.status(201).send(await issueSession(user));
    });

    scoped.post('/auth/login', async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const restaurantId = await currentRestaurantId();
      const phone = parseBurkinaPhone(body.phone).e164!;

      const user = await prisma.user.findUnique({
        where: { restaurantId_phone: { restaurantId, phone } },
      });

      // Message identique que le numéro soit inconnu ou le mot de passe faux : distinguer les deux
      // révélerait quels numéros sont inscrits.
      const invalid = unauthorized('Numéro ou mot de passe incorrect.');
      if (!user?.passwordHash) throw invalid;
      if (!user.isActive) throw unauthorized('Ce compte est désactivé.');
      if (!(await verifyPassword(user.passwordHash, body.password))) throw invalid;

      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
      return reply.send(await issueSession(user));
    });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(request.body);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized('Session expirée. Reconnectez-vous.');
    }

    // Rotation : le jeton présenté est révoqué et remplacé. S'il est rejoué, il ne vaut plus rien.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return reply.send(await issueSession(stored.user));
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
    if (body.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(body.refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.auth!.userId } });
    if (!user) throw unauthorized();
    return reply.send({ user: publicUser(user) });
  });

  app.patch('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        email: z.string().trim().email().or(z.literal('')).optional(),
        marketingConsent: z.boolean().optional(),
      })
      .parse(request.body);

    const user = await prisma.user.update({
      where: { id: request.auth!.userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.marketingConsent !== undefined && { marketingConsent: body.marketingConsent }),
      },
    });

    return reply.send({ user: publicUser(user) });
  });
}

async function issueSession(user: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  restaurantId: string;
  loyaltyPoints: number;
  marketingConsent: boolean;
}) {
  const { token, hash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: refreshTokenExpiry() },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role as never,
    restaurantId: user.restaurantId,
  });

  return { user: publicUser(user), accessToken, refreshToken: token };
}

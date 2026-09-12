/** Notifications de l'utilisateur connecté. */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { requireAuth } from '../../lib/guards.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const query = z.object({ take: z.coerce.number().int().min(1).max(50).default(20) }).parse(request.query);

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: request.auth!.userId },
        orderBy: { createdAt: 'desc' },
        take: query.take,
      }),
      prisma.notification.count({ where: { userId: request.auth!.userId, readAt: null } }),
    ]);

    return reply.send({ notifications, unread });
  });

  app.post('/notifications/read', { preHandler: requireAuth }, async (request, reply) => {
    const body = z.object({ ids: z.array(z.string()).optional() }).parse(request.body ?? {});
    await prisma.notification.updateMany({
      where: { userId: request.auth!.userId, readAt: null, ...(body.ids && { id: { in: body.ids } }) },
      data: { readAt: new Date() },
    });
    return reply.send({ ok: true });
  });

  /** Solde et historique de fidélité. */
  app.get('/loyalty', { preHandler: requireAuth }, async (request, reply) => {
    const [user, transactions] = await Promise.all([
      prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { loyaltyPoints: true } }),
      prisma.loyaltyTransaction.findMany({
        where: { userId: request.auth!.userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    return reply.send({ balance: user?.loyaltyPoints ?? 0, transactions });
  });

  /** Carnet d'adresses du client. */
  app.get('/addresses', { preHandler: requireAuth }, async (request, reply) => {
    const addresses = await prisma.address.findMany({
      where: { userId: request.auth!.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return reply.send({ addresses });
  });

  app.post('/addresses', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({
        label: z.string().trim().max(40).optional(),
        sector: z.string().trim().min(1).max(40),
        district: z.string().trim().max(80).optional(),
        landmark: z.string().trim().min(3).max(200),
        details: z.string().trim().max(200).optional(),
        isDefault: z.boolean().default(false),
      })
      .parse(request.body);

    const address = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({ where: { userId: request.auth!.userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          restaurantId: request.auth!.restaurantId,
          userId: request.auth!.userId,
          label: body.label ?? null,
          sector: body.sector,
          district: body.district ?? null,
          landmark: body.landmark,
          details: body.details ?? null,
          isDefault: body.isDefault,
        },
      });
    });

    return reply.status(201).send({ address });
  });

  app.delete('/addresses/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    await prisma.address.deleteMany({ where: { id, userId: request.auth!.userId } });
    return reply.send({ ok: true });
  });
}

/**
 * Tables et QR Codes.
 *
 * Le jeton d'une table est opaque et non devinable : s'il encodait le numéro de table, n'importe qui
 * commanderait sur la table 08 depuis chez lui (§ 8, critère A11).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateTableToken } from '@savora/shared';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { currentRestaurantId } from '../../lib/context.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { requireAbility } from '../../lib/guards.js';
import { audit } from '../../lib/audit.js';
import { emitToRestaurant } from '../../lib/realtime.js';

/** Durée d'une session de table : au-delà, un jeton photographié ne sert plus à rien. */
const SESSION_MINUTES = 90;

export async function tableRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Résolution d'un QR Code scanné. Publique par nature : le client qui scanne n'a pas de compte.
   * On ne renvoie que le numéro de table — jamais l'identifiant interne ni le jeton lui-même.
   */
  app.post('/tables/resolve', async (request, reply) => {
    const body = z
      .object({ token: z.string().min(10).max(64), deviceId: z.string().min(4).max(128) })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const table = await prisma.restaurantTable.findUnique({ where: { qrToken: body.token } });
    if (!table || table.restaurantId !== restaurantId || !table.isActive) {
      throw unprocessable('INVALID_TABLE', 'Ce QR Code n\'est pas valide. Demandez au personnel.');
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant?.dineInEnabled) {
      throw unprocessable('DINE_IN_DISABLED', 'Les commandes sur place sont momentanément suspendues.');
    }

    const session = await prisma.tableSession.create({
      data: {
        tableId: table.id,
        deviceId: body.deviceId,
        expiresAt: new Date(Date.now() + SESSION_MINUTES * 60_000),
      },
    });

    return reply.send({
      table: { number: table.number, capacity: table.capacity },
      session: { id: session.id, expiresAt: session.expiresAt },
    });
  });

  app.get('/tables', { preHandler: requireAbility('table:read') }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();

    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { number: 'asc' },
      include: {
        orders: {
          where: { status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, dailyNumber: true, status: true, total: true },
        },
      },
    });

    return reply.send({
      tables: tables.map((table) => ({
        id: table.id,
        number: table.number,
        capacity: table.capacity,
        status: table.status,
        isActive: table.isActive,
        currentOrder: table.orders[0] ?? null,
        qrUrl: `${env.PUBLIC_CLIENT_URL}/t/${table.qrToken}`,
      })),
    });
  });

  app.post('/tables', { preHandler: requireAbility('table:write') }, async (request, reply) => {
    const body = z
      .object({ number: z.string().trim().min(1).max(10), capacity: z.number().int().min(1).max(30).default(4) })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const table = await prisma.restaurantTable.create({
      data: { restaurantId, number: body.number, capacity: body.capacity, qrToken: generateTableToken() },
    });

    emitToRestaurant(restaurantId, 'table:updated', { tableId: table.id });
    return reply.status(201).send({
      table: { ...table, qrToken: undefined, qrUrl: `${env.PUBLIC_CLIENT_URL}/t/${table.qrToken}` },
    });
  });

  app.patch('/tables/:id', { preHandler: requireAbility('table:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        number: z.string().trim().min(1).max(10).optional(),
        capacity: z.number().int().min(1).max(30).optional(),
        status: z.enum(['FREE', 'OCCUPIED', 'PREPARING', 'TO_SERVE', 'SERVED']).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const existing = await prisma.restaurantTable.findFirst({ where: { id, restaurantId } });
    if (!existing) throw notFound('Table introuvable.');

    const table = await prisma.restaurantTable.update({ where: { id }, data: body });
    emitToRestaurant(restaurantId, 'table:updated', { tableId: table.id });
    return reply.send({ table: { ...table, qrToken: undefined } });
  });

  /**
   * Régénération du jeton : invalide immédiatement le QR Code imprimé. Utile si une table a été
   * photographiée et que le code circule.
   */
  app.post('/tables/:id/regenerate-qr', { preHandler: requireAbility('table:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const existing = await prisma.restaurantTable.findFirst({ where: { id, restaurantId } });
    if (!existing) throw notFound('Table introuvable.');

    const table = await prisma.restaurantTable.update({
      where: { id },
      data: { qrToken: generateTableToken() },
    });
    await prisma.tableSession.updateMany({
      where: { tableId: id, closedAt: null },
      data: { closedAt: new Date() },
    });

    await audit({
      restaurantId,
      actorId: request.auth?.userId,
      action: 'table.regenerate_qr',
      targetType: 'table',
      targetId: id,
    });

    return reply.send({
      table: { id: table.id, number: table.number },
      qrUrl: `${env.PUBLIC_CLIENT_URL}/t/${table.qrToken}`,
      message: 'Nouveau QR Code généré. Réimprimez-le : l\'ancien ne fonctionne plus.',
    });
  });

  app.delete('/tables/:id', { preHandler: requireAbility('table:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const used = await prisma.order.count({ where: { tableId: id } });
    if (used > 0) {
      const table = await prisma.restaurantTable.update({ where: { id }, data: { isActive: false } });
      return reply.send({ table: { id: table.id }, archived: true });
    }

    await prisma.restaurantTable.delete({ where: { id } });
    emitToRestaurant(restaurantId, 'table:updated', { tableId: id });
    return reply.send({ ok: true, archived: false });
  });
}

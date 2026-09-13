/**
 * Statistiques.
 *
 * Elles comptent **tous les canaux** : application, comptoir, téléphone, QR de table. Un tableau de
 * bord qui ignorerait le comptoir afficherait un chiffre d'affaires faux, donc inutile, donc ignoré
 * — et le logiciel avec lui (ADR 005).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { currentRestaurantId } from '../../lib/context.js';
import { requireAbility } from '../../lib/guards.js';

/** Une commande « réalisée » : encaissée et servie, par opposition à refusée ou annulée. */
const FULFILLED = ['COMPLETED', 'DELIVERED', 'PICKED_UP', 'SERVED'] as const;

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  /** Tableau de bord du jour — la page que le gérant regarde en premier. */
  app.get('/stats/today', { preHandler: requireAbility('order:read:all') }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [orders, preparing, ready, toDeliver] = await Promise.all([
      prisma.order.findMany({
        where: { restaurantId, createdAt: { gte: startOfDay } },
        select: { total: true, status: true, type: true, channel: true },
      }),
      prisma.order.count({ where: { restaurantId, status: { in: ['ACCEPTED', 'PREPARING'] } } }),
      prisma.order.count({ where: { restaurantId, status: 'READY', type: 'PICKUP' } }),
      prisma.order.count({ where: { restaurantId, status: { in: ['READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'] }, type: 'DELIVERY' } }),
    ]);

    const fulfilled = orders.filter((order) => FULFILLED.includes(order.status as never));
    const revenue = fulfilled.reduce((sum, order) => sum + order.total, 0);

    return reply.send({
      orderCount: orders.length,
      fulfilledCount: fulfilled.length,
      revenue,
      averageBasket: fulfilled.length > 0 ? Math.round(revenue / fulfilled.length) : 0,
      preparing,
      readyForPickup: ready,
      toDeliver,
      rejected: orders.filter((order) => order.status === 'REJECTED').length,
      byChannel: countBy(orders, 'channel'),
      byType: countBy(orders, 'type'),
    });
  });

  app.get('/stats/range', { preHandler: requireAbility('stats:read') }, async (request, reply) => {
    const query = z
      .object({ days: z.coerce.number().int().min(1).max(365).default(7) })
      .parse(request.query);
    const restaurantId = await currentRestaurantId();

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (query.days - 1));

    const orders = await prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: since } },
      select: { total: true, status: true, type: true, channel: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const fulfilled = orders.filter((order) => FULFILLED.includes(order.status as never));

    // Série quotidienne complète, y compris les jours sans commande : un trou dans un graphique se
    // lit comme une anomalie, pas comme un jour creux.
    const daily = new Map<string, { date: string; orders: number; revenue: number }>();
    for (let index = 0; index < query.days; index += 1) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      daily.set(key, { date: key, orders: 0, revenue: 0 });
    }
    for (const order of fulfilled) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const entry = daily.get(key);
      if (entry) {
        entry.orders += 1;
        entry.revenue += order.total;
      }
    }

    // Répartition horaire : c'est elle qui dit combien de personnes mettre en cuisine, et quand.
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
    for (const order of fulfilled) {
      const slot = hourly[order.createdAt.getUTCHours()];
      if (slot) slot.orders += 1;
    }

    const revenue = fulfilled.reduce((sum, order) => sum + order.total, 0);

    return reply.send({
      days: query.days,
      orderCount: orders.length,
      fulfilledCount: fulfilled.length,
      revenue,
      averageBasket: fulfilled.length > 0 ? Math.round(revenue / fulfilled.length) : 0,
      rejected: orders.filter((order) => order.status === 'REJECTED').length,
      cancelled: orders.filter((order) => order.status === 'CANCELLED').length,
      daily: [...daily.values()],
      hourly,
      byChannel: countBy(orders, 'channel'),
      byType: countBy(orders, 'type'),
    });
  });

  app.get('/stats/top-products', { preHandler: requireAbility('stats:read') }, async (request, reply) => {
    const query = z
      .object({
        days: z.coerce.number().int().min(1).max(365).default(30),
        take: z.coerce.number().int().min(1).max(50).default(10),
      })
      .parse(request.query);
    const restaurantId = await currentRestaurantId();

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - query.days);

    const items = await prisma.orderItem.findMany({
      where: {
        order: { restaurantId, createdAt: { gte: since }, status: { in: FULFILLED as never } },
      },
      select: { productName: true, quantity: true, lineTotal: true },
    });

    const totals = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const entry = totals.get(item.productName) ?? { name: item.productName, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.lineTotal;
      totals.set(item.productName, entry);
    }

    return reply.send({
      products: [...totals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, query.take),
    });
  });
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

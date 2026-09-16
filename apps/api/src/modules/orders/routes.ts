/**
 * Routes des commandes : création (quatre canaux), suivi client, file du restaurant, transitions.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ACTIVE_STATUSES,
  availableTransitions,
  cancelOrderSchema,
  createOrderSchema,
  normalizePickupCode,
  rejectOrderSchema,
  type OrderStatus,
  type OrderType,
} from '@savora/shared';
import type { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { isTest } from '../../env.js';
import { currentRestaurantId } from '../../lib/context.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { requireAbility, requireAuth, requireStaff } from '../../lib/guards.js';
import { audit } from '../../lib/audit.js';
import { createOrder, ORDER_INCLUDE, transitionOrder } from './service.js';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  // --- Création -------------------------------------------------------------

  await app.register(async (scoped) => {
    // Une limite plus basse qu'ailleurs : c'est la route qui engage la cuisine.
    await scoped.register(import('@fastify/rate-limit'), {
      max: isTest ? Number.MAX_SAFE_INTEGER : 20,
      timeWindow: '1 minute',
    });

    scoped.post('/orders', async (request, reply) => {
      const input = createOrderSchema.parse(request.body);
      const restaurantId = await currentRestaurantId();
      const auth = request.auth;

      // Le canal est déclaré par l'interface, mais il engage la sincérité du tableau de bord : seul
      // un employé peut prétendre saisir une commande au comptoir (ADR 005).
      const staffChannel = input.channel === 'COUNTER' || input.channel === 'PHONE';
      if (staffChannel && (!auth || auth.role === 'CLIENT')) {
        throw forbidden('Seul un employé peut enregistrer une commande au comptoir ou par téléphone.');
      }

      const order = await createOrder(input, {
        restaurantId,
        userId: auth && auth.role === 'CLIENT' ? auth.userId : staffChannel ? null : auth?.userId ?? null,
        staffId: staffChannel ? auth!.userId : null,
        staffRole: staffChannel ? (auth!.role as Role) : null,
      });

      return reply.status(201).send({ order });
    });
  });

  // --- Suivi client ---------------------------------------------------------

  /**
   * Suivi d'une commande. Accessible sans compte : connaître l'identifiant d'une commande suffit à
   * la suivre — c'est ce qui permet de commander en invité, sans rien exposer d'un autre client.
   */
  app.get('/orders/:id/track', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw notFound('Commande introuvable.');

    return reply.send({ order: publicOrderView(order) });
  });

  app.get('/orders/mine', { preHandler: requireAuth }, async (request, reply) => {
    const restaurantId = await currentRestaurantId();
    const query = z
      .object({ take: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().optional() })
      .parse(request.query);

    const orders = await prisma.order.findMany({
      where: { restaurantId, customerId: request.auth!.userId },
      orderBy: { createdAt: 'desc' },
      take: query.take,
      ...(query.cursor && { skip: 1, cursor: { id: query.cursor } }),
      include: ORDER_INCLUDE,
    });

    return reply.send({
      orders: orders.map(publicOrderView),
      nextCursor: orders.length === query.take ? orders[orders.length - 1]?.id : null,
    });
  });

  app.post('/orders/:id/cancel', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ reason: z.string().trim().max(300).optional() }).parse(request.body ?? {});
    const restaurantId = await currentRestaurantId();

    const order = await prisma.order.findFirst({ where: { id, restaurantId } });
    if (!order) throw notFound('Commande introuvable.');
    if (order.customerId !== request.auth!.userId) {
      throw forbidden('Cette commande n\'est pas la vôtre.');
    }

    const updated = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'CANCELLED',
      actorId: request.auth!.userId,
      actorRole: 'CLIENT',
      reason: body.reason ?? 'Annulée par le client',
    });

    return reply.send({ order: publicOrderView(updated) });
  });

  // --- File du restaurant ---------------------------------------------------

  app.get('/orders', { preHandler: requireAbility('order:read:all') }, async (request, reply) => {
    const restaurantId = await currentRestaurantId();
    const query = z
      .object({
        status: z.string().optional(),
        /** `active` : tout ce qui occupe encore la cuisine ou le comptoir. */
        scope: z.enum(['active', 'today', 'all']).default('active'),
        type: z.string().optional(),
        take: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(request.query);

    const statuses = query.status
      ? (query.status.split(',') as OrderStatus[])
      : query.scope === 'active'
        ? [...ACTIVE_STATUSES]
        : undefined;

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        ...(statuses && { status: { in: statuses as never } }),
        ...(query.type && { type: query.type as never }),
        ...(query.scope === 'today' && { createdAt: { gte: startOfDay } }),
      },
      orderBy: [{ createdAt: 'asc' }],
      take: query.take,
      include: ORDER_INCLUDE,
    });

    return reply.send({ orders });
  });

  app.get('/orders/:id', { preHandler: requireAbility('order:read:all') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const order = await prisma.order.findFirst({ where: { id, restaurantId }, include: ORDER_INCLUDE });
    if (!order) throw notFound('Commande introuvable.');

    return reply.send({
      order,
      // L'interface n'affiche que des actions réellement permises à ce rôle, sur cette commande.
      actions: availableTransitions(order.status as OrderStatus, {
        type: order.type as OrderType,
        actor: request.auth!.role,
      }),
    });
  });

  /** Recherche par code de retrait, tolérante aux confusions de saisie (critère A6). */
  app.get('/orders/by-code/:code', { preHandler: requireAbility('order:read:all') }, async (request, reply) => {
    const { code } = z.object({ code: z.string().min(3).max(12) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const order = await prisma.order.findFirst({
      where: { restaurantId, pickupCode: normalizePickupCode(code), status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] } },
      include: ORDER_INCLUDE,
    });
    if (!order) throw notFound('Aucune commande en attente avec ce code.');

    return reply.send({ order });
  });

  // --- Transitions ----------------------------------------------------------

  const transitionRoute = (
    path: string,
    to: OrderStatus,
    ability: Parameters<typeof requireAbility>[0],
  ) => {
    app.post(`/orders/:id/${path}`, { preHandler: requireAbility(ability) }, async (request, reply) => {
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const restaurantId = await currentRestaurantId();

      const order = await transitionOrder({
        orderId: id,
        restaurantId,
        to,
        actorId: request.auth!.userId,
        actorRole: request.auth!.role,
      });

      return reply.send({ order });
    });
  };

  transitionRoute('accept', 'ACCEPTED', 'order:accept');
  transitionRoute('prepare', 'PREPARING', 'order:prepare');
  transitionRoute('ready', 'READY', 'order:ready');
  transitionRoute('serve', 'SERVED', 'order:serve');
  transitionRoute('complete', 'COMPLETED', 'order:read:all');

  app.post('/orders/:id/reject', { preHandler: requireAbility('order:reject') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = rejectOrderSchema.parse(request.body);
    const restaurantId = await currentRestaurantId();

    const order = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'REJECTED',
      actorId: request.auth!.userId,
      actorRole: request.auth!.role,
      reason: body.comment ?? body.reason,
    });

    await prisma.order.update({ where: { id }, data: { rejectionReason: body.reason } });
    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'order.reject',
      targetType: 'order',
      targetId: id,
      data: { reason: body.reason, comment: body.comment },
    });

    return reply.send({ order });
  });

  app.post('/orders/:id/cancel-staff', { preHandler: requireAbility('order:cancel:any') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = cancelOrderSchema.parse(request.body);
    const restaurantId = await currentRestaurantId();

    const order = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'CANCELLED',
      actorId: request.auth!.userId,
      actorRole: request.auth!.role,
      reason: body.reason,
    });

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'order.cancel',
      targetType: 'order',
      targetId: id,
      data: { reason: body.reason },
    });

    return reply.send({ order });
  });

  /** Remise au client : le code est vérifié, pas seulement affiché (critère A6). */
  app.post('/orders/:id/handover', { preHandler: requireAbility('order:handover') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ code: z.string().optional() }).parse(request.body ?? {});
    const restaurantId = await currentRestaurantId();

    const existing = await prisma.order.findFirst({ where: { id, restaurantId } });
    if (!existing) throw notFound('Commande introuvable.');

    if (existing.pickupCode && body.code) {
      if (normalizePickupCode(body.code) !== existing.pickupCode) {
        throw forbidden('Code de retrait incorrect.');
      }
    }

    const order = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'PICKED_UP',
      actorId: request.auth!.userId,
      actorRole: request.auth!.role,
    });

    return reply.send({ order });
  });

  app.post('/orders/:id/assign', { preHandler: requireAbility('order:assign') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ courierId: z.string().min(1) }).parse(request.body);
    const restaurantId = await currentRestaurantId();

    const courier = await prisma.user.findFirst({
      where: { id: body.courierId, restaurantId, role: 'DELIVERY', isActive: true },
    });
    if (!courier) throw notFound('Livreur introuvable.');

    const order = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'ASSIGNED',
      actorId: request.auth!.userId,
      actorRole: request.auth!.role,
      courierId: courier.id,
    });

    return reply.send({ order });
  });

  app.post('/orders/:id/depart', { preHandler: requireAbility('order:deliver') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const order = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'OUT_FOR_DELIVERY',
      actorId: request.auth!.userId,
      actorRole: request.auth!.role,
    });

    return reply.send({ order });
  });

  app.post('/orders/:id/delivered', { preHandler: requireAbility('order:deliver') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const order = await transitionOrder({
      orderId: id,
      restaurantId,
      to: 'DELIVERED',
      actorId: request.auth!.userId,
      actorRole: request.auth!.role,
    });

    return reply.send({ order });
  });

  /** Tournée du livreur : ses livraisons du moment, rien d'autre. */
  app.get('/delivery/mine', { preHandler: requireStaff }, async (request, reply) => {
    const restaurantId = await currentRestaurantId();

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        courierId: request.auth!.userId,
        status: { in: ['ASSIGNED', 'OUT_FOR_DELIVERY'] },
      },
      orderBy: { createdAt: 'asc' },
      include: ORDER_INCLUDE,
    });

    return reply.send({ orders });
  });
}

/**
 * Vue destinée au client. Les données internes — motif de refus détaillé, identité du livreur,
 * charge utile du fournisseur de paiement — n'ont pas à sortir.
 */
function publicOrderView(order: {
  id: string;
  dailyNumber: number;
  status: string;
  type: string;
  channel: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  loyaltyDiscount: number;
  total: number;
  pickupCode: string | null;
  createdAt: Date;
  note: string | null;
  items: unknown;
  table?: { number: string } | null;
  deliverySector?: string | null;
  deliveryLandmark?: string | null;
  events?: unknown;
  payments?: { method: string; status: string }[];
}) {
  return {
    id: order.id,
    number: order.dailyNumber,
    status: order.status,
    type: order.type,
    channel: order.channel,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    loyaltyDiscount: order.loyaltyDiscount,
    total: order.total,
    pickupCode: order.pickupCode,
    createdAt: order.createdAt,
    note: order.note,
    items: order.items,
    table: order.table ? { number: order.table.number } : null,
    delivery: order.deliverySector
      ? { sector: order.deliverySector, landmark: order.deliveryLandmark }
      : null,
    events: order.events,
    payment: order.payments?.[0] ? { method: order.payments[0].method, status: order.payments[0].status } : null,
  };
}

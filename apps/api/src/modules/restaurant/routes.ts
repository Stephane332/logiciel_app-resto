/**
 * Restaurant : identité de marque, horaires, zones de livraison, paramètres, assistant de
 * configuration.
 *
 * Tout ce que le restaurant peut changer lui-même vit ici. Rien n'est codé en dur (ADR 004).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  brandInputSchema,
  deliveryZoneInputSchema,
  openingHourInputSchema,
  openingState,
  parseBurkinaPhone,
} from '@barabite/shared';
import { prisma } from '../../db.js';
import { currentRestaurantId } from '../../lib/context.js';
import { notFound } from '../../lib/errors.js';
import { requireAbility, requireStaff } from '../../lib/guards.js';
import { audit } from '../../lib/audit.js';

/** Étapes de l'assistant de configuration initiale (§ 2.8). */
const SETUP_STEPS = ['brand', 'hours', 'categories', 'products', 'tables', 'delivery', 'payment'] as const;

export async function restaurantRoutes(app: FastifyInstance): Promise<void> {
  /** Vitrine publique : marque, horaires, état d'ouverture, moyens de paiement autorisés. */
  app.get('/restaurant', async (_request, reply) => {
    const restaurantId = await currentRestaurantId();
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { openingHours: { orderBy: { weekday: 'asc' } }, deliveryZones: { where: { isActive: true }, orderBy: { position: 'asc' } } },
    });
    if (!restaurant) throw notFound('Restaurant introuvable.');

    const state = openingState({
      hours: restaurant.openingHours.map((h) => ({
        weekday: h.weekday,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        closed: h.closed,
      })),
      manuallyClosed: restaurant.manuallyClosed,
      timezoneOffsetMinutes: restaurant.timezoneOffsetMinutes,
    });

    return reply.send({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        tagline: restaurant.tagline,
        logoUrl: restaurant.logoUrl,
        primaryColor: restaurant.primaryColor,
        backgroundColor: restaurant.backgroundColor,
        phone: restaurant.phone,
        whatsapp: restaurant.whatsapp,
        address: restaurant.address,
        city: restaurant.city,
        currencySymbol: restaurant.currencySymbol,
        preparationMinutes: restaurant.preparationMinutes,
        modes: {
          delivery: restaurant.deliveryEnabled,
          pickup: restaurant.pickupEnabled,
          dineIn: restaurant.dineInEnabled,
        },
        payment: {
          online: restaurant.onlinePayment,
          cashOnDelivery: restaurant.cashOnDelivery,
          cashOnPickup: restaurant.cashOnPickup,
          cashOnDineIn: restaurant.cashOnDineIn,
        },
        loyalty: restaurant.loyaltyEnabled
          ? {
              amountPerPoint: restaurant.loyaltyAmountPerPoint,
              pointValue: restaurant.loyaltyPointValue,
              minimumPoints: restaurant.loyaltyMinimumPoints,
              maxRedemptionPct: restaurant.loyaltyMaxRedemptionPct,
            }
          : null,
      },
      openingHours: restaurant.openingHours,
      deliveryZones: restaurant.deliveryZones,
      state,
    });
  });

  app.patch('/restaurant/brand', { preHandler: requireAbility('brand:write') }, async (request, reply) => {
    const body = brandInputSchema.partial().parse(request.body);
    const restaurantId = await currentRestaurantId();

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.tagline !== undefined && { tagline: body.tagline ?? null }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
        ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
        ...(body.backgroundColor !== undefined && { backgroundColor: body.backgroundColor }),
        ...(body.phone !== undefined && { phone: parseBurkinaPhone(body.phone).e164 ?? body.phone }),
        ...(body.address !== undefined && { address: body.address ?? null }),
        ...(body.city !== undefined && { city: body.city ?? 'Ouahigouya' }),
      },
    });

    await markSetupStep(restaurantId, 'brand');
    await audit({ restaurantId, actorId: request.auth?.userId, action: 'restaurant.brand_update' });
    return reply.send({ restaurant });
  });

  app.patch('/restaurant/settings', { preHandler: requireAbility('settings:write') }, async (request, reply) => {
    const body = z
      .object({
        manuallyClosed: z.boolean().optional(),
        deliveryEnabled: z.boolean().optional(),
        pickupEnabled: z.boolean().optional(),
        dineInEnabled: z.boolean().optional(),
        cashOnDelivery: z.boolean().optional(),
        cashOnPickup: z.boolean().optional(),
        cashOnDineIn: z.boolean().optional(),
        onlinePayment: z.boolean().optional(),
        preparationMinutes: z.number().int().min(1).max(180).optional(),
        loyaltyEnabled: z.boolean().optional(),
        loyaltyAmountPerPoint: z.number().int().min(1).optional(),
        loyaltyPointValue: z.number().int().min(1).optional(),
        loyaltyMinimumPoints: z.number().int().min(0).optional(),
        loyaltyMaxRedemptionPct: z.number().int().min(1).max(100).optional(),
      })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const restaurant = await prisma.restaurant.update({ where: { id: restaurantId }, data: body });

    // Ouvrir ou fermer le restaurant, suspendre la livraison : des décisions qui méritent une trace.
    if (body.manuallyClosed !== undefined || body.deliveryEnabled !== undefined) {
      await audit({
        restaurantId,
        actorId: request.auth?.userId,
        action: 'restaurant.availability',
        data: body,
      });
    }

    return reply.send({ restaurant });
  });

  app.put('/restaurant/hours', { preHandler: requireAbility('settings:write') }, async (request, reply) => {
    const body = z.object({ hours: z.array(openingHourInputSchema).max(7) }).parse(request.body);
    const restaurantId = await currentRestaurantId();

    await prisma.$transaction(
      body.hours.map((hour) =>
        prisma.openingHour.upsert({
          where: { restaurantId_weekday: { restaurantId, weekday: hour.weekday } },
          create: { restaurantId, ...hour },
          update: { opensAt: hour.opensAt, closesAt: hour.closesAt, closed: hour.closed },
        }),
      ),
    );

    await markSetupStep(restaurantId, 'hours');
    const hours = await prisma.openingHour.findMany({ where: { restaurantId }, orderBy: { weekday: 'asc' } });
    return reply.send({ hours });
  });

  // --- Zones de livraison ---------------------------------------------------

  // Vue complète, zones inactives comprises : réservée au personnel. Les clients reçoivent les
  // zones actives par la route publique /restaurant.
  app.get('/restaurant/delivery-zones', { preHandler: [requireStaff, requireAbility('menu:read')] }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();
    const zones = await prisma.deliveryZone.findMany({ where: { restaurantId }, orderBy: { position: 'asc' } });
    return reply.send({ zones });
  });

  app.post('/restaurant/delivery-zones', { preHandler: requireAbility('delivery:zone:write') }, async (request, reply) => {
    const body = deliveryZoneInputSchema.parse(request.body);
    const restaurantId = await currentRestaurantId();
    const zone = await prisma.deliveryZone.create({ data: { restaurantId, ...body } });
    await markSetupStep(restaurantId, 'delivery');
    return reply.status(201).send({ zone });
  });

  app.patch('/restaurant/delivery-zones/:id', { preHandler: requireAbility('delivery:zone:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = deliveryZoneInputSchema.partial().parse(request.body);
    const restaurantId = await currentRestaurantId();

    const existing = await prisma.deliveryZone.findFirst({ where: { id, restaurantId } });
    if (!existing) throw notFound('Zone introuvable.');

    const zone = await prisma.deliveryZone.update({ where: { id }, data: body });
    return reply.send({ zone });
  });

  app.delete('/restaurant/delivery-zones/:id', { preHandler: requireAbility('delivery:zone:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

    const used = await prisma.order.count({ where: { deliveryZoneId: id } });
    if (used > 0) {
      const zone = await prisma.deliveryZone.update({ where: { id }, data: { isActive: false } });
      return reply.send({ zone, archived: true });
    }
    await prisma.deliveryZone.delete({ where: { id } });
    return reply.send({ ok: true, archived: false });
  });

  // --- Assistant de configuration -------------------------------------------

  /**
   * État de la configuration initiale. Le tableau de bord s'en sert pour montrer ce qu'il reste à
   * faire : un restaurant livré à lui-même doit savoir où il en est (§ 2.8).
   */
  app.get('/restaurant/setup', { preHandler: requireAbility('settings:write') }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw notFound('Restaurant introuvable.');

    const [categories, products, tables, zones, hours] = await Promise.all([
      prisma.category.count({ where: { restaurantId } }),
      prisma.product.count({ where: { restaurantId } }),
      prisma.restaurantTable.count({ where: { restaurantId } }),
      prisma.deliveryZone.count({ where: { restaurantId } }),
      prisma.openingHour.count({ where: { restaurantId } }),
    ]);

    const steps = [
      { key: 'brand', label: 'Nom, logo et couleurs', done: Boolean(restaurant.logoUrl) || restaurant.setupCompletedSteps.includes('brand') },
      { key: 'hours', label: 'Horaires d\'ouverture', done: hours > 0 },
      { key: 'categories', label: 'Catégories du menu', done: categories > 0 },
      { key: 'products', label: 'Produits et prix', done: products > 0 },
      { key: 'tables', label: 'Tables et QR Codes', done: tables > 0 || !restaurant.dineInEnabled },
      { key: 'delivery', label: 'Zones de livraison', done: zones > 0 || !restaurant.deliveryEnabled },
      { key: 'payment', label: 'Moyens de paiement', done: restaurant.setupCompletedSteps.includes('payment') },
    ];

    return reply.send({
      steps,
      completed: steps.filter((step) => step.done).length,
      total: steps.length,
      counts: { categories, products, tables, zones },
    });
  });

  app.post('/restaurant/setup/:step', { preHandler: requireAbility('settings:write') }, async (request, reply) => {
    const { step } = z.object({ step: z.enum(SETUP_STEPS) }).parse(request.params);
    const restaurantId = await currentRestaurantId();
    await markSetupStep(restaurantId, step);
    return reply.send({ ok: true, step });
  });
}

async function markSetupStep(restaurantId: string, step: string): Promise<void> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant || restaurant.setupCompletedSteps.includes(step)) return;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { setupCompletedSteps: { push: step } },
  });
}

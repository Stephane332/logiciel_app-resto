/**
 * Création et cycle de vie des commandes.
 *
 * C'est ici que se joue la sincérité du système : les prix viennent de la base et jamais de la
 * requête, les totaux sont recalculés côté serveur, et chaque transition passe par la machine à
 * états partagée. Une commande qui sort d'ici est une commande dont on peut répondre.
 */
import type { OrderStatus, OrderType, Prisma, Role } from '@prisma/client';
import {
  assertTransition,
  computeCart,
  generatePickupCode,
  initialStatus,
  isOpen,
  parseBurkinaPhone,
  pointsEarned,
  redeemPoints,
  statusLabel,
  type CartLine,
  type CreateOrderInput,
  type DiscountInput,
} from '@barabite/shared';
import { prisma } from '../../db.js';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { emitToOrder, emitToRestaurant } from '../../lib/realtime.js';
import { notify } from '../../lib/notify.js';

export const ORDER_INCLUDE = {
  items: { include: { options: true } },
  payments: true,
  table: true,
  deliveryZone: true,
  customer: { select: { id: true, name: true, phone: true, loyaltyPoints: true } },
  courier: { select: { id: true, name: true, phone: true } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export interface CreateOrderContext {
  restaurantId: string;
  /** Client authentifié, s'il y en a un. */
  userId?: string | null;
  /** Employé qui saisit la commande au comptoir. */
  staffId?: string | null;
  staffRole?: Role | null;
  deviceId?: string | null;
}

/** Date du jour côté restaurant, tronquée : sert de clé à la numérotation quotidienne. */
function orderDateFor(offsetMinutes: number): Date {
  const shifted = new Date(Date.now() + offsetMinutes * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export async function createOrder(
  input: CreateOrderInput,
  context: CreateOrderContext,
): Promise<OrderWithRelations> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: context.restaurantId },
    include: { openingHours: true },
  });
  if (!restaurant) throw notFound('Restaurant introuvable.');

  const staffOrder = input.channel === 'COUNTER' || input.channel === 'PHONE';
  if (staffOrder && !context.staffId) {
    throw badRequest('STAFF_REQUIRED', 'Une commande de caisse doit être saisie par un employé.');
  }

  // Hors horaires, la commande est refusée **côté serveur** (critère A12). Le personnel présent sur
  // place fait exception : s'il est là pour taper une commande, c'est que le restaurant sert.
  if (!staffOrder) {
    const open = isOpen({
      hours: restaurant.openingHours.map((h) => ({
        weekday: h.weekday,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        closed: h.closed,
      })),
      manuallyClosed: restaurant.manuallyClosed,
      timezoneOffsetMinutes: restaurant.timezoneOffsetMinutes,
    });
    if (!open) throw unprocessable('RESTAURANT_CLOSED', 'Le restaurant est actuellement fermé.');
  }

  if (input.type === 'DELIVERY' && !restaurant.deliveryEnabled) {
    throw unprocessable('DELIVERY_DISABLED', 'La livraison est momentanément suspendue.');
  }
  if (input.type === 'PICKUP' && !restaurant.pickupEnabled) {
    throw unprocessable('PICKUP_DISABLED', 'Le retrait est momentanément indisponible.');
  }
  if (input.type === 'DINE_IN' && !restaurant.dineInEnabled) {
    throw unprocessable('DINE_IN_DISABLED', 'Les commandes sur place sont momentanément suspendues.');
  }

  const { lines, stockUpdates } = await buildLines(context.restaurantId, input);

  // --- Table (sur place) ----------------------------------------------------
  let tableId: string | null = null;
  if (input.type === 'DINE_IN') {
    const table = await resolveTable(context.restaurantId, input.tableToken!);
    tableId = table.id;
  }

  // --- Livraison ------------------------------------------------------------
  let deliveryFee = 0;
  let deliveryZoneId: string | null = null;
  let addressFields: Record<string, string | null> = {};

  if (input.type === 'DELIVERY') {
    const resolved = await resolveDelivery(context.restaurantId, input, context.userId ?? null);
    deliveryFee = resolved.fee;
    deliveryZoneId = resolved.zoneId;
    addressFields = resolved.fields;

    const goodsTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (resolved.minimumOrder > 0 && goodsTotal < resolved.minimumOrder) {
      throw unprocessable(
        'BELOW_MINIMUM',
        `Cette zone exige une commande d'au moins ${resolved.minimumOrder} F.`,
      );
    }
  }

  // --- Promotion et fidélité ------------------------------------------------
  const { discount, promotionId } = await resolvePromotion(context.restaurantId, input, lines);

  let loyaltyDiscount = 0;
  const customerId = context.userId ?? null;
  if (input.loyaltyPointsToUse && customerId && restaurant.loyaltyEnabled) {
    const customer = await prisma.user.findUnique({ where: { id: customerId } });
    const eligible = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const result = redeemPoints(
      { balance: customer?.loyaltyPoints ?? 0, pointsToUse: input.loyaltyPointsToUse, eligibleAmount: eligible },
      {
        amountPerPoint: restaurant.loyaltyAmountPerPoint,
        pointValue: restaurant.loyaltyPointValue,
        minimumRedeemablePoints: restaurant.loyaltyMinimumPoints,
        maxRedemptionPercentage: restaurant.loyaltyMaxRedemptionPct,
      },
    );
    if (!result.ok) throw unprocessable('LOYALTY_REFUSED', result.reason);
    loyaltyDiscount = result.discount;
  }

  const totals = computeCart({ lines, deliveryFee, discount, loyaltyDiscount });

  // Le total annoncé par l'interface est confronté au total du serveur. Tout écart est refusé :
  // c'est le seul endroit du système où un mensonge rapporte de l'argent (critère A4).
  if (input.expectedTotal !== undefined && input.expectedTotal !== totals.total) {
    throw conflict(
      'TOTAL_MISMATCH',
      'Le montant a changé depuis l\'affichage. Vérifiez votre panier avant de valider.',
      { expected: input.expectedTotal, actual: totals.total },
    );
  }

  const status = initialStatus(input.channel);
  const orderDate = orderDateFor(restaurant.timezoneOffsetMinutes);
  const pickupCode = input.type === 'PICKUP' ? generatePickupCode() : null;
  const resolvedCustomerId = await resolveCustomer(context, input);

  const order = await prisma.$transaction(async (tx) => {
    // Le compteur est incrémenté dans la transaction : deux commandes simultanées ne peuvent pas
    // recevoir le même numéro.
    const counter = await tx.orderCounter.upsert({
      where: { restaurantId_orderDate: { restaurantId: context.restaurantId, orderDate } },
      create: { restaurantId: context.restaurantId, orderDate, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    const created = await tx.order.create({
      data: {
        restaurantId: context.restaurantId,
        dailyNumber: counter.lastNumber,
        orderDate,
        customerId: resolvedCustomerId,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ? parseBurkinaPhone(input.customerPhone).e164 : null,
        channel: input.channel,
        type: input.type,
        status,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        discount: totals.discount,
        loyaltyDiscount: totals.loyaltyDiscount,
        total: totals.total,
        note: input.note ?? null,
        pickupCode,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        tableId,
        deliveryZoneId,
        promotionId,
        ...addressFields,
        items: {
          create: totals.lines.map((line) => ({
            productId: line.productId,
            productName: line.name,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
            options: {
              create: (line.options ?? []).map((option) => ({
                optionItemId: option.id,
                name: option.name,
                priceDelta: option.priceDelta,
              })),
            },
          })),
        },
        events: {
          create: {
            status,
            actorId: context.staffId ?? context.userId ?? null,
            actorRole: context.staffRole ?? (context.userId ? 'CLIENT' : null),
          },
        },
        payments: {
          create: {
            amount: totals.total,
            method: input.paymentMethod,
            provider: input.paymentMethod === 'CASH' ? 'cash' : 'pending',
            status: 'PENDING',
          },
        },
      },
      include: ORDER_INCLUDE,
    });

    for (const update of stockUpdates) {
      await tx.product.update({
        where: { id: update.productId },
        data: { stock: { decrement: update.quantity } },
      });
    }
    // Un stock tombé à zéro rend le produit indisponible sans intervention humaine (§ 2.6).
    await tx.product.updateMany({
      where: { restaurantId: context.restaurantId, stock: { lte: 0 }, isAvailable: true },
      data: { isAvailable: false },
    });

    if (loyaltyDiscount > 0 && resolvedCustomerId) {
      const pointsUsed = Math.ceil(loyaltyDiscount / restaurant.loyaltyPointValue);
      const user = await tx.user.update({
        where: { id: resolvedCustomerId },
        data: { loyaltyPoints: { decrement: pointsUsed } },
      });
      await tx.loyaltyTransaction.create({
        data: {
          restaurantId: context.restaurantId,
          userId: resolvedCustomerId,
          orderId: created.id,
          points: -pointsUsed,
          reason: `Remise sur la commande ${created.dailyNumber}`,
          balance: user.loyaltyPoints,
        },
      });
    }

    if (promotionId) {
      await tx.promotion.update({ where: { id: promotionId }, data: { usedCount: { increment: 1 } } });
    }

    if (tableId) {
      await tx.restaurantTable.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } });
    }

    return created;
  });

  emitToRestaurant(context.restaurantId, 'order:created', order);
  emitToOrder(order.id, 'order:status', { orderId: order.id, status: order.status });

  return order;
}

// ---------------------------------------------------------------------------
// Construction des lignes
// ---------------------------------------------------------------------------

async function buildLines(
  restaurantId: string,
  input: CreateOrderInput,
): Promise<{ lines: CartLine[]; stockUpdates: { productId: string; quantity: number }[] }> {
  const productIds = [...new Set(input.lines.map((line) => line.productId))];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, restaurantId },
    include: { optionGroups: { include: { items: true } } },
  });

  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: CartLine[] = [];
  const stockUpdates: { productId: string; quantity: number }[] = [];
  const unavailable: string[] = [];

  for (const requested of input.lines) {
    const product = byId.get(requested.productId);
    if (!product) throw notFound(`Produit introuvable dans le menu.`);

    if (!product.isAvailable || (product.stock !== null && product.stock < requested.quantity)) {
      unavailable.push(product.name);
      continue;
    }

    const groups = product.optionGroups;
    const allowed = new Map(groups.flatMap((group) => group.items.map((item) => [item.id, { item, group }])));
    const chosen = requested.optionItemIds.map((id) => {
      const found = allowed.get(id);
      if (!found) throw badRequest('INVALID_OPTION', `Option inconnue pour « ${product.name} ».`);
      if (!found.item.isAvailable) {
        throw unprocessable('OPTION_UNAVAILABLE', `« ${found.item.name} » n'est plus disponible.`);
      }
      return found;
    });

    // Les règles de choix sont celles définies par le restaurant : un « choisissez une sauce »
    // obligatoire doit le rester côté serveur, sinon l'interface est la seule à le savoir.
    for (const group of groups) {
      const count = chosen.filter((c) => c.group.id === group.id).length;
      if (count < group.minChoices) {
        throw badRequest('OPTION_REQUIRED', `« ${group.name} » : choisissez au moins ${group.minChoices} option(s).`);
      }
      if (count > group.maxChoices) {
        throw badRequest('TOO_MANY_OPTIONS', `« ${group.name} » : ${group.maxChoices} option(s) maximum.`);
      }
    }

    lines.push({
      productId: product.id,
      name: product.name,
      // Le prix vient de la base, jamais de la requête.
      unitPrice: product.price,
      quantity: requested.quantity,
      options: chosen.map(({ item }) => ({ id: item.id, name: item.name, priceDelta: item.priceDelta })),
    });

    if (product.stock !== null) {
      stockUpdates.push({ productId: product.id, quantity: requested.quantity });
    }
  }

  if (unavailable.length > 0) {
    // On nomme précisément les produits fautifs : « commande impossible » sans détail oblige le
    // client à deviner (§ 6.6, critère A7).
    throw unprocessable(
      'ITEMS_UNAVAILABLE',
      `Ces produits ne sont plus disponibles : ${unavailable.join(', ')}.`,
      { unavailable },
    );
  }

  if (lines.length === 0) throw badRequest('EMPTY_CART', 'Le panier est vide.');

  return { lines, stockUpdates };
}

async function resolveTable(restaurantId: string, token: string) {
  const table = await prisma.restaurantTable.findUnique({ where: { qrToken: token } });
  if (!table || table.restaurantId !== restaurantId || !table.isActive) {
    throw unprocessable('INVALID_TABLE', 'Ce QR Code de table n\'est pas valide. Demandez au personnel.');
  }
  return table;
}

async function resolveDelivery(
  restaurantId: string,
  input: CreateOrderInput,
  userId: string | null,
): Promise<{
  fee: number;
  zoneId: string | null;
  minimumOrder: number;
  fields: Record<string, string | null>;
}> {
  let sector: string | null = null;
  let district: string | null = null;
  let landmark: string | null = null;
  let details: string | null = null;
  let addressId: string | null = null;

  if (input.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, restaurantId, ...(userId ? { userId } : {}) },
    });
    if (!address) throw notFound('Adresse introuvable.');
    ({ sector, district, landmark, details } = address);
    addressId = address.id;
  } else if (input.address) {
    sector = input.address.sector;
    district = input.address.district ?? null;
    landmark = input.address.landmark;
    details = input.address.details ?? null;
  } else {
    throw badRequest('ADDRESS_REQUIRED', 'Une adresse de livraison est requise.');
  }

  let zone = input.deliveryZoneId
    ? await prisma.deliveryZone.findFirst({ where: { id: input.deliveryZoneId, restaurantId } })
    : null;

  // Sans zone explicite, on tente de la déduire du secteur — c'est ainsi qu'on se repère ici.
  if (!zone && sector) {
    zone = await prisma.deliveryZone.findFirst({
      where: { restaurantId, isActive: true, name: { equals: sector, mode: 'insensitive' } },
    });
  }

  if (!zone) {
    throw unprocessable(
      'OUT_OF_DELIVERY_AREA',
      'Cette zone n\'est pas desservie. Choisissez le retrait ou contactez le restaurant.',
    );
  }
  if (!zone.isActive) {
    throw unprocessable('ZONE_DISABLED', 'La livraison est suspendue dans cette zone.');
  }

  return {
    fee: zone.fee,
    zoneId: zone.id,
    minimumOrder: zone.minimumOrder,
    fields: {
      addressId,
      deliverySector: sector,
      deliveryDistrict: district,
      deliveryLandmark: landmark,
      deliveryDetails: details,
    },
  };
}

async function resolvePromotion(
  restaurantId: string,
  input: CreateOrderInput,
  lines: CartLine[],
): Promise<{ discount: DiscountInput; promotionId: string | null }> {
  if (!input.promotionCode) return { discount: { kind: 'NONE' }, promotionId: null };

  const promotion = await prisma.promotion.findUnique({
    where: { restaurantId_code: { restaurantId, code: input.promotionCode.toUpperCase() } },
  });

  const now = new Date();
  const invalid = !promotion
    || !promotion.isActive
    || (promotion.startsAt && promotion.startsAt > now)
    || (promotion.endsAt && promotion.endsAt < now)
    || (promotion.maxUses !== null && promotion.usedCount >= promotion.maxUses);

  if (invalid || !promotion) {
    throw unprocessable('INVALID_PROMOTION', 'Ce code promotionnel n\'est pas valable.');
  }

  const goodsTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (goodsTotal < promotion.minimumOrder) {
    throw unprocessable(
      'PROMOTION_MINIMUM',
      `Ce code s'applique à partir de ${promotion.minimumOrder} F de commande.`,
    );
  }

  return {
    discount:
      promotion.discountType === 'PERCENTAGE'
        ? { kind: 'PERCENTAGE', value: promotion.value, label: promotion.label }
        : { kind: 'AMOUNT', value: promotion.value, label: promotion.label },
    promotionId: promotion.id,
  };
}

/**
 * Rattache la commande à un client.
 * Une commande passée sans compte crée discrètement un compte autour du numéro de téléphone : le
 * client retrouvera son historique et ses points s'il s'inscrit plus tard, sans rien perdre (§ 2.2).
 */
async function resolveCustomer(
  context: CreateOrderContext,
  input: CreateOrderInput,
): Promise<string | null> {
  if (context.userId) return context.userId;
  if (!input.customerPhone) return null;

  const parsed = parseBurkinaPhone(input.customerPhone);
  if (!parsed.ok || !parsed.e164) return null;

  const existing = await prisma.user.findUnique({
    where: { restaurantId_phone: { restaurantId: context.restaurantId, phone: parsed.e164 } },
  });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      restaurantId: context.restaurantId,
      phone: parsed.e164,
      name: input.customerName ?? 'Client',
      role: 'CLIENT',
    },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Transitions de statut
// ---------------------------------------------------------------------------

export interface TransitionInput {
  orderId: string;
  restaurantId: string;
  to: OrderStatus;
  actorId?: string | null;
  actorRole: Role | 'SYSTEM';
  reason?: string | null;
  courierId?: string | null;
}

/**
 * Applique un changement de statut.
 *
 * La machine à états partagée juge la transition ; la base enregistre le résultat et sa trace. Une
 * transition interdite est refusée, jamais silencieusement ignorée (critère A8).
 */
export async function transitionOrder(input: TransitionInput): Promise<OrderWithRelations> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    include: { customer: true, payments: true },
  });
  if (!order) throw notFound('Commande introuvable.');

  assertTransition(order.status as OrderStatus, input.to, {
    type: order.type as OrderType,
    actor: input.actorRole,
    reason: input.reason,
  });

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: order.id },
      data: {
        status: input.to,
        ...(input.to === 'ACCEPTED' && { acceptedAt: now }),
        ...(input.to === 'READY' && { readyAt: now }),
        ...(isCompletion(input.to) && { completedAt: now }),
        ...(input.courierId && { courierId: input.courierId }),
        ...(input.to === 'REJECTED' && { rejectionComment: input.reason ?? null }),
        ...((input.to === 'CANCELLED' || input.to === 'EXPIRED') && { cancelReason: input.reason ?? null }),
        events: {
          create: {
            status: input.to,
            actorId: input.actorId ?? null,
            actorRole: input.actorRole,
            reason: input.reason ?? null,
          },
        },
      },
      include: ORDER_INCLUDE,
    });

    // Une commande qui ne se fera pas rend son stock : sans cela, chaque refus fait disparaître des
    // produits de l'inventaire sans qu'ils aient été vendus.
    if (isAbandoned(input.to)) {
      for (const item of result.items) {
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, stock: { not: null } },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      if (order.loyaltyDiscount > 0 && order.customerId) {
        const refundedPoints = Math.ceil(order.loyaltyDiscount / 1);
        const user = await tx.user.update({
          where: { id: order.customerId },
          data: { loyaltyPoints: { increment: refundedPoints } },
        });
        await tx.loyaltyTransaction.create({
          data: {
            restaurantId: input.restaurantId,
            userId: order.customerId,
            orderId: order.id,
            points: refundedPoints,
            reason: 'Commande annulée : points restitués',
            balance: user.loyaltyPoints,
          },
        });
      }
    }

    // Les points sont crédités à la livraison effective, pas à la commande : on récompense un repas
    // servi, pas une intention.
    if (isCompletion(input.to) && order.customerId) {
      const restaurant = await tx.restaurant.findUnique({ where: { id: input.restaurantId } });
      if (restaurant?.loyaltyEnabled) {
        const eligible = order.subtotal - order.discount - order.loyaltyDiscount;
        const points = pointsEarned(Math.max(0, eligible), {
          amountPerPoint: restaurant.loyaltyAmountPerPoint,
          pointValue: restaurant.loyaltyPointValue,
          minimumRedeemablePoints: restaurant.loyaltyMinimumPoints,
          maxRedemptionPercentage: restaurant.loyaltyMaxRedemptionPct,
        });
        if (points > 0) {
          const user = await tx.user.update({
            where: { id: order.customerId },
            data: { loyaltyPoints: { increment: points } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              restaurantId: input.restaurantId,
              userId: order.customerId,
              orderId: order.id,
              points,
              reason: `Commande n° ${order.dailyNumber}`,
              balance: user.loyaltyPoints,
            },
          });
        }
      }
    }

    // Encaissement en espèces : constaté à la remise, seul moment où l'argent change réellement de
    // main. Le Mobile Money, lui, n'est jamais confirmé ici mais par webhook (ADR 007).
    if (isCompletion(input.to)) {
      await tx.payment.updateMany({
        where: { orderId: order.id, method: 'CASH', status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt: now },
      });
    }

    if (result.tableId) {
      const tableStatus = tableStatusFor(input.to);
      if (tableStatus) {
        await tx.restaurantTable.update({ where: { id: result.tableId }, data: { status: tableStatus } });
      }
    }

    return result;
  });

  emitToRestaurant(input.restaurantId, 'order:updated', updated);
  emitToOrder(updated.id, 'order:status', { orderId: updated.id, status: updated.status });

  if (updated.customerId) {
    await notify({
      restaurantId: input.restaurantId,
      userId: updated.customerId,
      title: `Commande n° ${updated.dailyNumber}`,
      body: customerMessage(updated.status as OrderStatus, updated.pickupCode),
      data: { orderId: updated.id, status: updated.status },
    });
  }

  return updated;
}

function isCompletion(status: OrderStatus): boolean {
  return status === 'COMPLETED' || status === 'DELIVERED' || status === 'PICKED_UP' || status === 'SERVED';
}

function isAbandoned(status: OrderStatus): boolean {
  return status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED' || status === 'PAYMENT_FAILED';
}

function tableStatusFor(status: OrderStatus) {
  switch (status) {
    case 'PREPARING':
      return 'PREPARING' as const;
    case 'READY':
      return 'TO_SERVE' as const;
    case 'SERVED':
      return 'SERVED' as const;
    case 'COMPLETED':
    case 'CANCELLED':
    case 'REJECTED':
      return 'FREE' as const;
    default:
      return null;
  }
}

/** Message destiné au client : concret, en français courant, avec l'information utile. */
function customerMessage(status: OrderStatus, pickupCode: string | null): string {
  switch (status) {
    case 'ACCEPTED':
      return 'Votre commande est confirmée. La préparation va commencer.';
    case 'PREPARING':
      return 'Votre commande est en préparation.';
    case 'READY':
      return pickupCode
        ? `Votre commande est prête. Code de retrait : ${pickupCode}.`
        : 'Votre commande est prête.';
    case 'ASSIGNED':
      return 'Un livreur a pris votre commande en charge.';
    case 'OUT_FOR_DELIVERY':
      return 'Votre commande est en route.';
    case 'DELIVERED':
      return 'Votre commande a été livrée. Bon appétit !';
    case 'PICKED_UP':
      return 'Commande récupérée. Bon appétit !';
    case 'SERVED':
      return 'Votre commande est servie. Bon appétit !';
    case 'REJECTED':
      return 'Votre commande n\'a pas pu être acceptée. Le restaurant vous contactera.';
    case 'CANCELLED':
      return 'Votre commande a été annulée.';
    case 'EXPIRED':
      return 'Votre commande n\'a pas été récupérée.';
    default:
      return statusLabel(status);
  }
}

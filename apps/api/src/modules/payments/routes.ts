/**
 * Paiements : initiation, webhook, encaissement au comptoir, remboursement.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { isTest } from '../../env.js';
import { currentRestaurantId } from '../../lib/context.js';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { requireAbility } from '../../lib/guards.js';
import { audit } from '../../lib/audit.js';
import { emitToOrder, emitToRestaurant } from '../../lib/realtime.js';
import { providerFor } from '../../payments/index.js';
import { transitionOrder } from '../orders/service.js';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  /** Initiation d'un paiement en ligne : renvoie les consignes ou l'URL du fournisseur. */
  app.post('/payments/:orderId/initiate', async (request, reply) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { payments: true, customer: true },
    });
    if (!order) throw notFound('Commande introuvable.');

    const payment = order.payments.find((p) => p.status === 'PENDING');
    if (!payment) throw conflict('NO_PENDING_PAYMENT', 'Aucun paiement en attente sur cette commande.');
    if (payment.method === 'CASH') {
      throw badRequest('CASH_PAYMENT', 'Cette commande se règle en espèces, sans paiement en ligne.');
    }

    const provider = providerFor(payment.method);
    const result = await provider.initiate({
      orderId: order.id,
      paymentId: payment.id,
      amount: payment.amount,
      method: payment.method,
      customerPhone: order.customerPhone ?? order.customer?.phone ?? null,
      customerName: order.customerName ?? order.customer?.name ?? null,
      description: `Commande n° ${order.dailyNumber}`,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider: provider.name,
        providerReference: result.providerReference,
        status: result.status,
      },
    });

    return reply.send({
      payment: { id: updated.id, status: updated.status, amount: updated.amount },
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
    });
  });

  /**
   * Webhook du fournisseur — le seul chemin par lequel un paiement en ligne devient confirmé.
   * Signature vérifiée, puis transaction confrontée à la source, puis montant recoupé.
   */
  await app.register(async (scoped) => {
    await scoped.register(import('@fastify/rate-limit'), {
      max: isTest ? Number.MAX_SAFE_INTEGER : 60,
      timeWindow: '1 minute',
    });

    scoped.post('/payments/webhook/:provider', async (request, reply) => {
      const { provider: providerName } = z.object({ provider: z.string().min(1) }).parse(request.params);
      const provider = providerFor(providerName === 'cash' ? 'CASH' : 'ORANGE_MONEY');

      const verification = await provider.verifyWebhook(request.body, request.headers);
      if (!verification.valid || !verification.providerReference) {
        request.log.warn({ providerName, reason: verification.reason }, 'webhook de paiement rejeté');
        // Réponse volontairement avare : un webhook falsifié n'apprend rien de la raison du rejet.
        return reply.status(400).send({ error: { code: 'INVALID_WEBHOOK', message: 'Webhook rejeté.' } });
      }

      const payment = await prisma.payment.findUnique({
        where: { providerReference: verification.providerReference },
        include: { order: true },
      });
      if (!payment) throw notFound('Paiement introuvable.');

      // Rejeu : un webhook déjà traité ne réencaisse pas.
      if (payment.status === 'CONFIRMED') {
        return reply.send({ ok: true, alreadyProcessed: true });
      }

      // On redemande au fournisseur : le webhook annonce, la vérification confirme (ADR 007).
      const confirmed = await provider.verifyTransaction(verification.providerReference);
      if (!confirmed.valid || confirmed.status !== 'CONFIRMED') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failureReason: confirmed.reason ?? 'Vérification échouée.' },
        });
        return reply.send({ ok: true, status: 'FAILED' });
      }

      if (verification.amount !== undefined && verification.amount !== payment.amount) {
        // Montant divergent : on n'encaisse pas, et on laisse une trace pour enquête.
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failureReason: `Montant divergent : ${verification.amount} au lieu de ${payment.amount}.` },
        });
        await audit({
          restaurantId: payment.order.restaurantId,
          action: 'payment.amount_mismatch',
          targetType: 'payment',
          targetId: payment.id,
          data: { expected: payment.amount, received: verification.amount },
        });
        return reply.status(409).send({ error: { code: 'AMOUNT_MISMATCH', message: 'Montant incohérent.' } });
      }

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), rawPayload: request.body as never },
      });

      await audit({
        restaurantId: payment.order.restaurantId,
        action: 'payment.confirmed',
        targetType: 'payment',
        targetId: payment.id,
        data: { amount: updated.amount, provider: providerName },
      });

      emitToRestaurant(payment.order.restaurantId, 'payment:updated', {
        orderId: payment.orderId,
        status: updated.status,
      });
      emitToOrder(payment.orderId, 'payment:updated', { orderId: payment.orderId, status: updated.status });

      return reply.send({ ok: true, status: updated.status });
    });
  });

  /** Encaissement au comptoir : l'employé constate que l'argent a été reçu. */
  app.post('/payments/:orderId/collect', { preHandler: requireAbility('payment:collect') }, async (request, reply) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(request.params);
    const body = z
      .object({ method: z.enum(['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'MTN_MONEY', 'CARD']).default('CASH') })
      .parse(request.body ?? {});
    const restaurantId = await currentRestaurantId();

    const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId }, include: { payments: true } });
    if (!order) throw notFound('Commande introuvable.');

    const payment = order.payments.find((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
    if (!payment) throw conflict('NO_PENDING_PAYMENT', 'Cette commande est déjà réglée.');

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CONFIRMED', method: body.method, confirmedAt: new Date(), provider: 'counter' },
    });

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'payment.collect',
      targetType: 'payment',
      targetId: payment.id,
      data: { amount: updated.amount, method: body.method },
    });

    emitToRestaurant(restaurantId, 'payment:updated', { orderId, status: updated.status });
    return reply.send({ payment: updated });
  });

  /** Remboursement : manuel en V1, mais toujours tracé (§ 6.7). */
  app.post('/payments/:paymentId/refund', { preHandler: requireAbility('payment:refund') }, async (request, reply) => {
    const { paymentId } = z.object({ paymentId: z.string().min(1) }).parse(request.params);
    const body = z
      .object({ amount: z.number().int().min(1).optional(), reason: z.string().trim().min(3).max(300) })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true, refunds: true },
    });
    if (!payment || payment.order.restaurantId !== restaurantId) throw notFound('Paiement introuvable.');
    if (payment.status !== 'CONFIRMED' && payment.status !== 'REFUNDED') {
      throw unprocessable('NOT_REFUNDABLE', 'Ce paiement n\'a pas été encaissé.');
    }

    const alreadyRefunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
    const amount = body.amount ?? payment.amount - alreadyRefunded;
    if (amount <= 0 || alreadyRefunded + amount > payment.amount) {
      throw unprocessable('REFUND_TOO_LARGE', 'Le montant dépasse ce qui reste remboursable.');
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: { paymentId, amount, reason: body.reason, actorId: request.auth!.userId },
      });
      if (alreadyRefunded + amount === payment.amount) {
        await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
      }
      return created;
    });

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'payment.refund',
      targetType: 'payment',
      targetId: paymentId,
      data: { amount, reason: body.reason },
    });

    return reply.send({ refund });
  });

  /**
   * Confirmation d'un paiement simulé — démonstration uniquement.
   * Indisponible en production : le fournisseur simulé y refuse déjà toute initiation.
   */
  app.post('/payments/:orderId/simulate', async (request, reply) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    if (process.env.NODE_ENV === 'production') {
      throw badRequest('NOT_AVAILABLE', 'Indisponible en production.');
    }

    const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId }, include: { payments: true } });
    if (!order) throw notFound('Commande introuvable.');

    const payment = order.payments.find((p) => p.status !== 'CONFIRMED');
    if (!payment) throw conflict('ALREADY_PAID', 'Commande déjà réglée.');

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), provider: 'sandbox' },
    });

    emitToOrder(orderId, 'payment:updated', { orderId, status: updated.status });
    emitToRestaurant(restaurantId, 'payment:updated', { orderId, status: updated.status });

    return reply.send({ payment: updated });
  });
}

export { transitionOrder };

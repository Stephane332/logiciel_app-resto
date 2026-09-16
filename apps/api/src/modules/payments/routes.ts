/**
 * Paiements : initiation, webhook, encaissement au comptoir, remboursement.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { looksLikeTransactionId, matchSmsToPayment } from '@savora/shared';
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
      ussdCode: result.ussdCode,
      dialLink: result.dialLink,
      merchantNumber: result.merchantNumber,
      requiresDeclaration: result.requiresDeclaration ?? false,
    });
  });

  // -------------------------------------------------------------------------
  // Mobile Money déclaré puis attesté (ADR 008)
  //
  //   Celui qui paie ne confirme jamais son propre paiement.
  //
  // Le client déclare ; le restaurant, qui reçoit le SMS de l'opérateur sur son
  // propre téléphone, atteste. Un client peut mentir dans le champ
  // « identifiant ». Il ne peut pas faire apparaître un SMS chez le patron.
  // -------------------------------------------------------------------------

  /** Le client recopie l'identifiant reçu par SMS. Déclaration, jamais preuve. */
  app.post('/payments/:orderId/declare', async (request, reply) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(request.params);
    const body = z.object({ reference: z.string().trim().min(1).max(40) }).parse(request.body);
    const restaurantId = await currentRestaurantId();

    if (!looksLikeTransactionId(body.reference)) {
      throw badRequest(
        'INVALID_REFERENCE',
        "Cet identifiant ne ressemble pas à celui d'un SMS d'opérateur. Recopiez-le tel quel.",
      );
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { payments: true },
    });
    if (!order) throw notFound('Commande introuvable.');

    const payment = order.payments.find(
      (p) => p.status === 'PENDING' || p.status === 'PROCESSING' || p.status === 'DECLARED',
    );
    if (!payment) throw conflict('NO_PENDING_PAYMENT', 'Cette commande est déjà réglée.');
    if (payment.method === 'CASH') {
      throw badRequest('CASH_PAYMENT', 'Cette commande se règle en espèces, sans déclaration.');
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        // DECLARED, surtout pas CONFIRMED : la parole du payeur n'encaisse rien.
        status: 'DECLARED',
        declaredReference: body.reference.trim(),
        declaredAt: new Date(),
      },
    });

    emitToRestaurant(restaurantId, 'payment:updated', { orderId, status: updated.status });
    emitToOrder(orderId, 'payment:updated', { orderId, status: updated.status });

    return reply.send({
      payment: { id: updated.id, status: updated.status },
      message: 'Déclaration enregistrée. Le restaurant vérifie et confirme.',
    });
  });

  /** File des paiements déclarés, en attente d'attestation. */
  app.get('/payments/to-verify', { preHandler: requireAbility('payment:collect') }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();

    const payments = await prisma.payment.findMany({
      where: { status: 'DECLARED', order: { restaurantId } },
      orderBy: { declaredAt: 'desc' },
      take: 100,
      include: {
        order: {
          select: {
            id: true, dailyNumber: true, type: true, status: true,
            customerName: true, customerPhone: true,
            customer: { select: { name: true, phone: true } },
          },
        },
      },
    });

    return reply.send({ payments });
  });

  /**
   * Le restaurant atteste : il a vu l'argent arriver, ou non.
   *
   * Réservé au personnel. C'est le seul chemin par lequel un paiement Mobile
   * Money devient confirmé dans ce mode.
   */
  app.post('/payments/:paymentId/attest', { preHandler: requireAbility('payment:collect') }, async (request, reply) => {
    const { paymentId } = z.object({ paymentId: z.string().min(1) }).parse(request.params);
    const body = z
      .object({ received: z.boolean(), note: z.string().trim().max(500).optional() })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, order: { restaurantId } },
      include: { order: true },
    });
    if (!payment) throw notFound('Paiement introuvable.');
    if (payment.status === 'CONFIRMED') {
      return reply.send({ payment, alreadyConfirmed: true });
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: body.received ? 'CONFIRMED' : 'FAILED',
        attestedById: request.auth!.userId,
        attestedAt: new Date(),
        attestNote: body.note ?? null,
        ...(body.received ? { confirmedAt: new Date() } : { failureReason: 'Aucun paiement constaté par le restaurant.' }),
      },
    });

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: body.received ? 'payment.attested' : 'payment.attest_failed',
      targetType: 'payment',
      targetId: paymentId,
      data: { amount: updated.amount, declaredReference: updated.declaredReference, note: body.note },
    });

    emitToRestaurant(restaurantId, 'payment:updated', { orderId: payment.orderId, status: updated.status });
    emitToOrder(payment.orderId, 'payment:updated', { orderId: payment.orderId, status: updated.status });

    return reply.send({ payment: updated });
  });

  /**
   * Lecture du SMS de l'opérateur.
   *
   * Le restaurant colle le message reçu sur le téléphone du marchand ; le
   * serveur en tire le montant et l'identifiant, et désigne la commande
   * correspondante. Ce n'est pas un contournement de la règle : c'est elle,
   * automatisée. La source reste le SMS du bénéficiaire, jamais la parole du
   * payeur — et cette route est réservée au personnel.
   */
  app.post('/payments/read-sms', { preHandler: requireAbility('payment:collect') }, async (request, reply) => {
    const body = z.object({ text: z.string().trim().min(5).max(2000) }).parse(request.body);
    const restaurantId = await currentRestaurantId();

    const pending = await prisma.payment.findMany({
      where: { status: 'DECLARED', order: { restaurantId } },
      orderBy: { declaredAt: 'desc' },
      take: 200,
      include: { order: { select: { id: true, dailyNumber: true, customerName: true } } },
    });

    const match = matchSmsToPayment(
      body.text,
      pending.map((p) => ({
        id: p.id,
        amount: p.amount,
        declaredReference: p.declaredReference,
        createdAt: p.declaredAt ?? p.createdAt,
      })),
    );

    const hydrate = (id: string) => pending.find((p) => p.id === id);

    if (match.kind === 'MATCHED') {
      return reply.send({
        kind: 'MATCHED',
        byReference: match.byReference,
        payment: hydrate(match.payment.id),
      });
    }
    if (match.kind === 'AMBIGUOUS') {
      // On refuse de choisir : attester au hasard déclarerait payée une commande
      // qui ne l'est pas.
      return reply.send({
        kind: 'AMBIGUOUS',
        amount: match.amount,
        candidates: match.candidates.map((c) => hydrate(c.id)).filter(Boolean),
      });
    }
    return reply.send(match);
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

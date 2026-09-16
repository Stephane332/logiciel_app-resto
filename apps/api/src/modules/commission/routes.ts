/**
 * Commission de la plateforme : relevé, détail, arrêté de période, reversement.
 *
 * Tout est lisible par le restaurant. Ce n'est pas une politesse : une commission qu'on ne peut ni
 * voir, ni recouper, ni contester détruit la relation à la première fin de mois où le restaurateur
 * fait ses comptes. Chaque écriture porte donc sa commande, son assiette et le taux appliqué — de
 * quoi refaire le calcul à la main, ce qu'il fera au moins une fois.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildUssdCode, looksLikeTransactionId, ussdDialLink } from '@barabite/shared';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { currentRestaurantId } from '../../lib/context.js';
import { badRequest, notFound, unprocessable } from '../../lib/errors.js';
import { requireAbility } from '../../lib/guards.js';
import { audit } from '../../lib/audit.js';
import { closePeriod, rattraperCommissions, summarize } from './service.js';

export async function commissionRoutes(app: FastifyInstance): Promise<void> {
  /** Relevé : le taux, l'encours de la période, et ce qui reste exigible. */
  app.get('/commission/summary', { preHandler: requireAbility('commission:read') }, async () => {
    const restaurantId = await currentRestaurantId();
    // Le montant affiché doit être juste au moment où on le regarde.
    await rattraperCommissions(restaurantId);
    const summary = await summarize(restaurantId);

    return {
      ...summary,
      platform: {
        name: env.PLATFORM_NAME,
        momoNumber: env.PLATFORM_MOMO_NUMBER || null,
        operator: env.PLATFORM_MOMO_OPERATOR,
      },
    };
  });

  /**
   * Détail, commande par commande.
   *
   * C'est la pièce qui rend la commission vérifiable : sans elle, le restaurant ne peut que croire
   * le total sur parole.
   */
  app.get('/commission/entries', { preHandler: requireAbility('commission:read') }, async (request) => {
    const restaurantId = await currentRestaurantId();
    const query = z
      .object({ periodKey: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(200) })
      .parse(request.query);

    const entries = await prisma.commissionEntry.findMany({
      where: { restaurantId, ...(query.periodKey ? { periodKey: query.periodKey } : {}) },
      include: {
        order: {
          select: { id: true, dailyNumber: true, orderDate: true, channel: true, type: true, total: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });

    return { entries };
  });

  /** Historique des relevés arrêtés. */
  app.get('/commission/settlements', { preHandler: requireAbility('commission:read') }, async () => {
    const restaurantId = await currentRestaurantId();
    const settlements = await prisma.commissionSettlement.findMany({
      where: { restaurantId },
      orderBy: { periodStart: 'desc' },
      take: 24,
    });
    return { settlements };
  });

  /**
   * Arrête une période et fige son montant.
   *
   * Refusé sur la période en cours : figer un total auquel des ventes vont encore s'ajouter
   * produirait une facture qui ne correspond à rien de vérifiable.
   */
  app.post('/commission/settlements/close', { preHandler: requireAbility('commission:read') }, async (request) => {
    const restaurantId = await currentRestaurantId();
    const body = z.object({ periodKey: z.string().min(4) }).parse(request.body);

    await rattraperCommissions(restaurantId);

    let result;
    try {
      result = await closePeriod(restaurantId, body.periodKey);
    } catch (error) {
      throw badRequest('PERIOD_STILL_OPEN', (error as Error).message);
    }
    if (!result) throw notFound('Aucune commission à arrêter sur cette période.');

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'commission.period_closed',
      targetType: 'commission_settlement',
      targetId: result.id,
      data: { periodKey: body.periodKey, amount: result.amount, entryCount: result.entryCount },
    });

    return result;
  });

  /**
   * Comment reverser : le code de transfert, déjà rempli.
   *
   * Le montant et le numéro de la plateforme sont injectés dans le modèle par **nom de marqueur**,
   * jamais par position — l'ordre des paramètres diffère d'un code d'opérateur à l'autre.
   */
  app.get('/commission/settlements/:id/transfer', { preHandler: requireAbility('commission:read') }, async (request) => {
    const restaurantId = await currentRestaurantId();
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

    const settlement = await prisma.commissionSettlement.findFirst({ where: { id, restaurantId } });
    if (!settlement) throw notFound('Relevé introuvable.');
    if (!env.PLATFORM_MOMO_NUMBER) {
      throw unprocessable('PLATFORM_NUMBER_MISSING', "Le numéro de reversement de la plateforme n'est pas configuré.");
    }

    const ussdCode = buildUssdCode({
      template: env.PLATFORM_MOMO_USSD,
      merchantNumber: env.PLATFORM_MOMO_NUMBER,
      amount: settlement.amount,
    });

    return {
      amount: settlement.amount,
      periodLabel: settlement.periodLabel,
      recipient: { name: env.PLATFORM_NAME, number: env.PLATFORM_MOMO_NUMBER, operator: env.PLATFORM_MOMO_OPERATOR },
      ussdCode,
      dialLink: ussdDialLink(ussdCode),
    };
  });

  /**
   * Le restaurant déclare avoir reversé.
   *
   * Comme pour un paiement client, la déclaration ne vaut pas preuve : la plateforme constatera le
   * virement sur son propre téléphone. La règle ne change pas de sens parce qu'elle s'applique
   * cette fois en faveur du restaurant — celui qui paie ne confirme jamais son propre paiement.
   */
  app.post('/commission/settlements/:id/declare', { preHandler: requireAbility('commission:read') }, async (request) => {
    const restaurantId = await currentRestaurantId();
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ reference: z.string().trim().min(4).max(60) }).parse(request.body);

    if (!looksLikeTransactionId(body.reference)) {
      throw badRequest('BAD_REFERENCE', "Recopiez l'identifiant tel qu'il apparaît dans le SMS de l'opérateur.");
    }

    const settlement = await prisma.commissionSettlement.findFirst({ where: { id, restaurantId } });
    if (!settlement) throw notFound('Relevé introuvable.');
    if (settlement.status === 'PAID') return { settlement, alreadyPaid: true };
    if (settlement.status === 'OPEN') {
      throw badRequest('PERIOD_STILL_OPEN', "Cette période n'est pas encore arrêtée.");
    }

    const updated = await prisma.commissionSettlement.update({
      where: { id },
      data: { status: 'DECLARED', declaredReference: body.reference, declaredAt: new Date() },
    });

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'commission.settlement_declared',
      targetType: 'commission_settlement',
      targetId: id,
      data: { amount: updated.amount, reference: body.reference },
    });

    return { settlement: updated };
  });
}

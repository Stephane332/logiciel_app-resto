/**
 * Commission de la plateforme : accumulation et relevés.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  La plateforme ne touche jamais l'argent. Elle tient un compte, et le dit.    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le client paie le restaurant directement, de son téléphone au numéro marchand (ADR 008). Aucun
 * intermédiaire ne se trouve dans le flux — c'est précisément ce qui permet de se passer d'un
 * agrégateur. Personne ne peut donc prélever au passage : il n'y a pas de passage. La commission
 * est une dette enregistrée, réglée par un transfert en fin de période (ADR 009).
 *
 * Trois règles gouvernent ce fichier :
 *   — on ne facture que ce qui a été servi ;
 *   — on ne facture jamais deux fois ;
 *   — on n'efface rien, on contre-passe.
 */
import { Prisma } from '@prisma/client';
import {
  type CommissionPlan,
  type OrderChannel,
  type SettlementPeriod,
  commissionFor,
  periodBounds,
  periodKey,
  periodLabel,
} from '@savora/shared';
import { prisma } from '../../db.js';

/** Le contrat en vigueur pour ce restaurant, tel qu'il figure dans ses réglages. */
export function planOf(restaurant: {
  commissionRateBps: number;
  commissionChannels: string[];
  commissionPeriod: string;
}): CommissionPlan {
  return {
    rateBps: restaurant.commissionRateBps,
    billableChannels: restaurant.commissionChannels as OrderChannel[],
    period: restaurant.commissionPeriod as SettlementPeriod,
  };
}

export interface AccrualResult {
  created: boolean;
  amount: number;
  reason?: 'deja_facturee' | 'canal_non_facturable' | 'commission_desactivee' | 'montant_nul';
}

/**
 * Inscrit la commission due par une commande servie.
 *
 * **Idempotent par construction.** Une commande de livraison passe par `DELIVERED` puis `COMPLETED`,
 * donc cette fonction est appelée deux fois pour la même vente ; deux requêtes simultanées peuvent
 * en outre passer ensemble le test d'existence. Le garde-fou n'est donc pas le `findUnique` qui
 * suit — c'est la contrainte d'unicité sur `orderId`, et la capture du P2002 qui l'accompagne.
 * Vérifier sans contraindre reviendrait à facturer deux fois le jour où le restaurant est chargé,
 * c'est-à-dire le jour où cela se remarque le moins.
 */
export async function accrueCommission(orderId: string): Promise<AccrualResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: true, commissionEntry: true },
  });

  if (!order) return { created: false, amount: 0, reason: 'deja_facturee' };
  if (order.commissionEntry) {
    return { created: false, amount: order.commissionEntry.amount, reason: 'deja_facturee' };
  }
  if (!order.restaurant.commissionEnabled) {
    return { created: false, amount: 0, reason: 'commission_desactivee' };
  }

  const plan = planOf(order.restaurant);
  const line = commissionFor(
    {
      channel: order.channel as OrderChannel,
      subtotal: order.subtotal,
      discount: order.discount,
      loyaltyDiscount: order.loyaltyDiscount,
      deliveryFee: order.deliveryFee,
    },
    plan,
  );

  if (!line.billable) return { created: false, amount: 0, reason: 'canal_non_facturable' };
  // Une commande entièrement offerte ne doit rien : inscrire une ligne à zéro encombrerait le
  // relevé sans rien lui apprendre.
  if (line.amount === 0) return { created: false, amount: 0, reason: 'montant_nul' };

  const reference = order.completedAt ?? new Date();

  try {
    await prisma.commissionEntry.create({
      data: {
        restaurantId: order.restaurantId,
        orderId: order.id,
        base: line.base,
        rateBps: line.rateBps,
        amount: line.amount,
        periodKey: periodKey(reference, plan.period),
      },
    });
    return { created: true, amount: line.amount };
  } catch (error) {
    // Course perdue : une autre requête vient d'inscrire la même vente. C'est le résultat voulu.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { created: false, amount: line.amount, reason: 'deja_facturee' };
    }
    throw error;
  }
}

/**
 * Contre-passe la commission d'une vente remboursée.
 *
 * L'écriture n'est pas supprimée. Un relevé qu'on ne peut plus recouper avec l'historique des
 * commandes ne vaut rien précisément le jour où il sert : celui où quelqu'un conteste un montant.
 */
export async function reverseCommission(orderId: string, note?: string): Promise<boolean> {
  const entry = await prisma.commissionEntry.findUnique({ where: { orderId } });
  if (!entry || entry.reversed) return false;

  // Une écriture déjà reversée ne se contre-passe pas en silence : l'argent est parti, le crédit
  // doit apparaître sur la période courante plutôt que réécrire un relevé soldé.
  await prisma.commissionEntry.update({
    where: { id: entry.id },
    data: { reversed: true, reversedAt: new Date(), reversalNote: note ?? null },
  });
  return true;
}

export interface CommissionSummary {
  enabled: boolean;
  rateBps: number;
  period: SettlementPeriod;
  billableChannels: string[];
  periodKey: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  /** Dû sur la période en cours, contre-passations déduites. */
  dueThisPeriod: number;
  entryCount: number;
  /** Relevés arrêtés et non encore réglés — c'est ce qui est réellement exigible. */
  outstanding: number;
  outstandingSettlements: number;
}

/** Ce que le restaurant doit voir : l'encours, et rien qu'il ne puisse recouper. */
export async function summarize(restaurantId: string, now = new Date()): Promise<CommissionSummary> {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
  const plan = planOf(restaurant);
  const key = periodKey(now, plan.period);
  const { start, end } = periodBounds(now, plan.period);

  const [entries, unpaid] = await Promise.all([
    prisma.commissionEntry.findMany({
      where: { restaurantId, periodKey: key },
      select: { amount: true, reversed: true },
    }),
    prisma.commissionSettlement.findMany({
      where: { restaurantId, status: { in: ['CLOSED', 'DECLARED'] } },
      select: { amount: true },
    }),
  ]);

  const dueThisPeriod = Math.max(
    0,
    entries.reduce((sum, e) => sum + (e.reversed ? -e.amount : e.amount), 0),
  );

  return {
    enabled: restaurant.commissionEnabled,
    rateBps: restaurant.commissionRateBps,
    period: plan.period,
    billableChannels: restaurant.commissionChannels,
    periodKey: key,
    periodLabel: periodLabel(start, plan.period),
    periodStart: start,
    periodEnd: end,
    dueThisPeriod,
    entryCount: entries.filter((e) => !e.reversed).length,
    outstanding: unpaid.reduce((sum, s) => sum + s.amount, 0),
    outstandingSettlements: unpaid.length,
  };
}

/**
 * Arrête une période et fige son montant.
 *
 * Une période encore ouverte ne se clôt pas : on figerait un total auquel des ventes vont encore
 * s'ajouter, et le restaurant paierait une somme qui ne correspondrait à rien de vérifiable.
 */
export async function closePeriod(
  restaurantId: string,
  periodKeyToClose: string,
  now = new Date(),
): Promise<{ id: string; amount: number; entryCount: number } | null> {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
  const plan = planOf(restaurant);

  if (periodKeyToClose === periodKey(now, plan.period)) {
    throw new Error('La période en cours ne peut pas être arrêtée : des ventes peuvent encore s\'y ajouter.');
  }

  const entries = await prisma.commissionEntry.findMany({
    where: { restaurantId, periodKey: periodKeyToClose, settlementId: null },
  });
  if (entries.length === 0) return null;

  const amount = Math.max(0, entries.reduce((sum, e) => sum + (e.reversed ? -e.amount : e.amount), 0));
  const reference = entries[0]!.createdAt;
  const { start, end } = periodBounds(reference, plan.period);

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.commissionSettlement.upsert({
      where: { restaurantId_periodKey: { restaurantId, periodKey: periodKeyToClose } },
      create: {
        restaurantId,
        periodKey: periodKeyToClose,
        periodStart: start,
        periodEnd: end,
        periodLabel: periodLabel(start, plan.period),
        entryCount: entries.filter((e) => !e.reversed).length,
        amount,
        status: 'CLOSED',
        closedAt: now,
      },
      update: {
        entryCount: entries.filter((e) => !e.reversed).length,
        amount,
        status: 'CLOSED',
        closedAt: now,
      },
    });

    await tx.commissionEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { settlementId: settlement.id },
    });

    return { id: settlement.id, amount: settlement.amount, entryCount: settlement.entryCount };
  });
}

/**
 * Rattrape les ventes servies qui n'ont pas d'écriture.
 *
 * L'inscription se fait au fil de l'eau, hors transaction, pour qu'une écriture comptable ne puisse
 * jamais faire échouer la remise d'une commande à un client. La contrepartie est qu'elle peut
 * échouer — base indisponible une seconde, redémarrage au mauvais moment. Comme l'écriture se
 * déduit entièrement de l'état des commandes, elle se reconstitue : rien n'est perdu, seulement
 * différé.
 *
 * Appelé à la consultation du relevé. C'est le bon moment : le montant affiché est alors à jour au
 * moment précis où quelqu'un le regarde.
 */
export async function rattraperCommissions(restaurantId: string, limit = 200): Promise<number> {
  const manquantes = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { in: ['COMPLETED', 'DELIVERED', 'PICKED_UP', 'SERVED'] },
      commissionEntry: { is: null },
    },
    select: { id: true },
    orderBy: { completedAt: 'desc' },
    take: limit,
  });

  let inscrites = 0;
  for (const { id } of manquantes) {
    const result = await accrueCommission(id);
    if (result.created) inscrites += 1;
  }
  return inscrites;
}

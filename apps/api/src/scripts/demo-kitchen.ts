/**
 * Simulateur de cuisine.
 *
 * Fait avancer les commandes comme le ferait le personnel, pour démontrer l'application cliente de
 * bout en bout **avant** que le logiciel restaurant existe. Outil de développement : il refuse de
 * s'exécuter en production, où faire avancer des commandes sans personne derrière serait un mensonge
 * fait au client.
 */
import { prisma } from '../db.js';
import { transitionOrder } from '../modules/orders/service.js';
import { isProduction } from '../env.js';

const STEP_SECONDS = Number(process.env.DEMO_STEP_SECONDS ?? 8);

const NEXT: Record<string, string> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
};

const AFTER_READY: Record<string, string> = {
  PICKUP: 'PICKED_UP',
  DINE_IN: 'SERVED',
  DELIVERY: 'ASSIGNED',
};

const DELIVERY_CHAIN: Record<string, string> = {
  ASSIGNED: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

async function tick(): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'] } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  for (const order of orders) {
    const next =
      NEXT[order.status] ??
      (order.status === 'READY' ? AFTER_READY[order.type] : DELIVERY_CHAIN[order.status]);
    if (!next) continue;

    try {
      await transitionOrder({
        orderId: order.id,
        restaurantId: order.restaurantId,
        to: next as never,
        actorRole: 'CASHIER',
        actorId: null,
      });
      console.log(`Commande n° ${order.dailyNumber} : ${order.status} → ${next}`);
    } catch (error) {
      console.warn(`Commande n° ${order.dailyNumber} : ${(error as Error).message}`);
    }
  }
}

async function main(): Promise<void> {
  if (isProduction) {
    console.error('Le simulateur de cuisine est interdit en production.');
    process.exit(1);
  }

  console.log(`Simulateur de cuisine — une étape toutes les ${STEP_SECONDS} s. Ctrl+C pour arrêter.\n`);
  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, STEP_SECONDS * 1000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

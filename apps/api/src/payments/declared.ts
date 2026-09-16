/**
 * Mobile Money déclaré puis attesté — sans agrégateur.
 *
 *   Celui qui paie ne confirme jamais son propre paiement.
 *
 * Ce fournisseur ne parle à personne. Il produit le code USSD que le client
 * compose, et s'arrête là. La confirmation ne vient jamais d'ici : elle vient de
 * l'attestation du restaurant, qui a reçu le SMS de l'opérateur sur son propre
 * téléphone (voir `modules/payments/routes.ts`, route `attest`).
 *
 * C'est pourquoi `verifyWebhook` et `verifyTransaction` refusent : il n'existe
 * aucun canal automatique par lequel un paiement pourrait se confirmer seul, et
 * en laisser croire un serait le trou par lequel un client se déclarerait payé.
 *
 * Approche reprise de Resto Papou Service (Ouahigouya) — voir ADR 008.
 */
import { buildUssdCode, ussdDialLink } from '@savora/shared';
import { prisma } from '../db.js';
import { badRequest } from '../lib/errors.js';
import type { PaymentProvider } from './provider.js';

export const declaredProvider: PaymentProvider = {
  name: 'declared',
  supportedMethods: ['ORANGE_MONEY', 'MOOV_MONEY'],

  async initiate(input) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { restaurantId: true },
    });
    if (!order) throw badRequest('ORDER_NOT_FOUND', 'Commande introuvable.');

    const restaurant = await prisma.restaurant.findUnique({ where: { id: order.restaurantId } });
    if (!restaurant) throw badRequest('RESTAURANT_NOT_FOUND', 'Restaurant introuvable.');

    const orange = input.method === 'ORANGE_MONEY';
    const enabled = orange ? restaurant.orangeMoneyEnabled : restaurant.moovMoneyEnabled;
    const number = orange ? restaurant.orangeMoneyNumber : restaurant.moovMoneyNumber;
    const template = orange ? restaurant.orangeMoneyUssd : restaurant.moovMoneyUssd;

    if (!enabled || !number) {
      throw badRequest(
        'METHOD_UNAVAILABLE',
        `${orange ? 'Orange Money' : 'Moov Money'} n'est pas activé par le restaurant.`,
      );
    }

    const code = buildUssdCode({ template, merchantNumber: number, amount: input.amount });

    return {
      // Pas de référence d'agrégateur : on marque le paiement de son propre identifiant,
      // ce qui garde la contrainte d'unicité utile sans prétendre à une transaction externe.
      providerReference: `declared_${input.paymentId}`,
      status: 'PENDING',
      instructions: `Composez ${code}, puis recopiez l'identifiant reçu par SMS.`,
      ussdCode: code,
      dialLink: ussdDialLink(code),
      merchantNumber: number,
      requiresDeclaration: true,
    };
  },

  async verifyWebhook() {
    // Aucun webhook n'existe pour ce mode. En accepter un reviendrait à ouvrir
    // une porte par laquelle un paiement se confirmerait sans que personne au
    // restaurant n'ait vu l'argent arriver.
    return { valid: false, reason: 'Le paiement déclaré ne reçoit aucune notification automatique.' };
  },

  async verifyTransaction() {
    return {
      valid: false,
      reason: "Ce mode ne se vérifie pas automatiquement : il exige l'attestation du restaurant.",
    };
  },
};

/**
 * Paiement en espèces.
 *
 * L'argent change de main au comptoir ou à la livraison : le système ne fait qu'enregistrer une
 * promesse, confirmée lors de la remise effective (voir `transitionOrder`).
 */
import type { PaymentProvider } from './provider.js';

export const cashProvider: PaymentProvider = {
  name: 'cash',
  supportedMethods: ['CASH'],

  async initiate(input) {
    return {
      providerReference: `cash_${input.paymentId}`,
      status: 'PENDING',
      instructions: 'À régler en espèces à la remise de la commande.',
    };
  },

  async verifyWebhook() {
    // Les espèces n'ont pas de webhook : personne ne notifie un billet.
    return { valid: false, reason: 'Le paiement en espèces ne reçoit pas de notification.' };
  },

  async verifyTransaction(providerReference) {
    return { valid: true, providerReference, status: 'CONFIRMED' };
  },
};

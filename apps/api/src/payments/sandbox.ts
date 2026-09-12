/**
 * Fournisseur simulé — développement, démonstration et recette.
 *
 * Reproduit fidèlement le cycle d'un agrégateur réel : initiation, webhook signé, vérification.
 * Cela permet de développer et de démontrer les trois parcours aujourd'hui, et de brancher
 * l'agrégateur réel demain sans modifier une ligne du code métier.
 *
 * Refuse de démarrer en production : un paiement simulé qui passerait en vrai serait un désastre.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, isProduction } from '../env.js';
import type { PaymentProvider } from './provider.js';

function sign(payload: string): string {
  return createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(payload).digest('hex');
}

export const sandboxProvider: PaymentProvider = {
  name: 'sandbox',
  supportedMethods: ['ORANGE_MONEY', 'MOOV_MONEY', 'MTN_MONEY', 'CARD'],

  async initiate(input) {
    if (isProduction) {
      throw new Error('Le fournisseur de paiement simulé ne peut pas être utilisé en production.');
    }
    return {
      providerReference: `sbx_${input.paymentId}_${Date.now().toString(36)}`,
      status: 'PROCESSING',
      instructions: 'Paiement simulé : confirmez-le depuis l\'interface de démonstration.',
    };
  },

  async verifyWebhook(payload, headers) {
    const body = payload as { reference?: string; status?: string; amount?: number };
    const signature = headers['x-barabite-signature'];

    if (typeof signature !== 'string' || !body.reference) {
      return { valid: false, reason: 'Signature ou référence manquante.' };
    }

    const expected = sign(JSON.stringify(payload));
    const provided = Buffer.from(signature);
    const computed = Buffer.from(expected);

    // Comparaison à temps constant : une comparaison naïve laisse deviner la signature octet à octet.
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      return { valid: false, reason: 'Signature invalide.' };
    }

    return {
      valid: true,
      providerReference: body.reference,
      status: body.status === 'success' ? 'CONFIRMED' : body.status === 'cancelled' ? 'CANCELLED' : 'FAILED',
      amount: body.amount,
    };
  },

  async verifyTransaction(providerReference) {
    return { valid: true, providerReference, status: 'CONFIRMED' };
  },
};

/** Utilitaire de démonstration : produit la signature qu'enverrait l'agrégateur. */
export function signSandboxPayload(payload: unknown): string {
  return sign(JSON.stringify(payload));
}

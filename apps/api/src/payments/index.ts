/**
 * Registre des fournisseurs de paiement.
 *
 * Brancher Orange Money ou Moov Money via CinetPay ou Ligdicash consiste à écrire un fichier
 * implémentant `PaymentProvider` et à l'ajouter ici. Rien d'autre dans le système ne bouge.
 */
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';
import { cashProvider } from './cash.js';
import { sandboxProvider } from './sandbox.js';
import type { PaymentProvider } from './provider.js';

const providers = new Map<string, PaymentProvider>([
  [cashProvider.name, cashProvider],
  [sandboxProvider.name, sandboxProvider],
]);

export function providerFor(method: string): PaymentProvider {
  if (method === 'CASH') return cashProvider;

  const configured = providers.get(env.PAYMENT_PROVIDER);
  if (!configured) {
    throw badRequest(
      'PAYMENT_PROVIDER_MISSING',
      `Aucun fournisseur n'est branché pour « ${env.PAYMENT_PROVIDER} ». Le paiement en ligne est indisponible.`,
    );
  }
  if (!configured.supportedMethods.includes(method as never)) {
    throw badRequest('METHOD_UNSUPPORTED', `Ce moyen de paiement n'est pas disponible actuellement.`);
  }
  return configured;
}

export { cashProvider, sandboxProvider };
export type { PaymentProvider } from './provider.js';

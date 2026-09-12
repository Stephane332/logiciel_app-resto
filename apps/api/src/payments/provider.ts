/**
 * Interface des fournisseurs de paiement (ADR 007).
 *
 * Aucun agrégateur Mobile Money n'est encore contractualisé. Plutôt que d'attendre un contrat pour
 * concevoir l'intégration — ce qui produirait un branchement bâclé le jour venu — le système définit
 * ici le contrat que devra remplir CinetPay, Ligdicash ou tout autre agrégateur.
 *
 * Règle absolue : un paiement n'est jamais confirmé sur la foi de l'application cliente. C'est le
 * seul endroit du système où un mensonge rapporte de l'argent.
 */
import type { PaymentMethod } from '@prisma/client';

export interface PaymentInitInput {
  orderId: string;
  paymentId: string;
  amount: number;
  method: PaymentMethod;
  customerPhone?: string | null;
  customerName?: string | null;
  description: string;
  returnUrl?: string;
}

export interface PaymentInitResult {
  /** Référence du fournisseur, unique : elle empêche un webhook rejoué de payer deux fois. */
  providerReference: string;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED';
  /** Page de paiement, lorsque le fournisseur en propose une. */
  redirectUrl?: string;
  /** Consigne affichée au client — par exemple la syntaxe USSD à composer. */
  instructions?: string;
}

export interface WebhookVerification {
  valid: boolean;
  providerReference?: string;
  status?: 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  amount?: number;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  readonly supportedMethods: readonly PaymentMethod[];

  initiate(input: PaymentInitInput): Promise<PaymentInitResult>;

  /**
   * Vérifie l'authenticité d'un webhook, signature comprise.
   * Un webhook non signé, ou mal signé, n'est pas une information : c'est une tentative.
   */
  verifyWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<WebhookVerification>;

  /**
   * Interroge le fournisseur sur l'état réel d'une transaction.
   * Appelée **après** le webhook : on ne confirme un encaissement qu'après l'avoir demandé à la
   * source, jamais sur la seule foi d'un message reçu.
   */
  verifyTransaction(providerReference: string): Promise<WebhookVerification>;
}

/**
 * Programme de fidélité.
 *
 * Remonté de la V2 à la V1 : dans une ville de 125 000 habitants, le chiffre d'affaires vient des
 * habitués, pas d'un flux anonyme. C'est le levier de rétention le moins coûteux du projet.
 */
import { type Amount, assertAmount } from './money.js';

export interface LoyaltyConfig {
  /** Francs dépensés pour gagner un point. */
  readonly amountPerPoint: Amount;
  /** Valeur d'un point en francs, lors de son utilisation. */
  readonly pointValue: Amount;
  /** Palier minimum avant de pouvoir utiliser ses points. */
  readonly minimumRedeemablePoints: number;
  /** Part maximale du sous-total payable en points, en pourcentage. */
  readonly maxRedemptionPercentage: number;
}

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  amountPerPoint: 100,
  pointValue: 1,
  minimumRedeemablePoints: 500,
  maxRedemptionPercentage: 50,
};

/**
 * Points gagnés sur une commande. Les frais de livraison en sont exclus : ils ne représentent ni une
 * dépense de restauration, ni une marge à récompenser.
 */
export function pointsEarned(
  eligibleAmount: Amount,
  config: LoyaltyConfig = DEFAULT_LOYALTY,
): number {
  assertAmount(eligibleAmount, 'montant éligible');
  if (config.amountPerPoint <= 0) return 0;
  return Math.floor(eligibleAmount / config.amountPerPoint);
}

export interface RedemptionRequest {
  readonly balance: number;
  readonly pointsToUse: number;
  readonly eligibleAmount: Amount;
}

export type RedemptionResult =
  | { readonly ok: true; readonly pointsUsed: number; readonly discount: Amount }
  | { readonly ok: false; readonly reason: string };

/** Convertit des points en remise, en refusant clairement lorsque les conditions ne sont pas réunies. */
export function redeemPoints(
  request: RedemptionRequest,
  config: LoyaltyConfig = DEFAULT_LOYALTY,
): RedemptionResult {
  assertAmount(request.eligibleAmount, 'montant éligible');

  if (!Number.isInteger(request.pointsToUse) || request.pointsToUse <= 0) {
    return { ok: false, reason: 'Nombre de points invalide.' };
  }
  if (request.pointsToUse > request.balance) {
    return { ok: false, reason: 'Solde de points insuffisant.' };
  }
  if (request.balance < config.minimumRedeemablePoints) {
    return {
      ok: false,
      reason: `Il faut au moins ${config.minimumRedeemablePoints} points pour en profiter.`,
    };
  }

  const ceiling = Math.floor((request.eligibleAmount * config.maxRedemptionPercentage) / 100);
  const requested = request.pointsToUse * config.pointValue;
  const discount = Math.min(requested, ceiling);

  if (discount <= 0) {
    return { ok: false, reason: 'Montant trop faible pour utiliser des points.' };
  }

  const pointsUsed = Math.ceil(discount / config.pointValue);
  return { ok: true, pointsUsed, discount };
}

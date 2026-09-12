/**
 * Calcul des totaux d'une commande.
 *
 * Cette fonction est la même côté client et côté serveur : c'est ce qui rend structurellement
 * impossible l'écart entre le total affiché et le total facturé (critère d'acceptation A4).
 * Le serveur reste néanmoins l'autorité — le client prévoit, le serveur décide (ADR 002).
 */
import { type Amount, assertAmount, applyPercentage, subtractFloor } from './money.js';

export interface CartLineOption {
  readonly id: string;
  readonly name: string;
  /** Supplément unitaire en FCFA. Zéro pour une option gratuite (une sauce au choix, par exemple). */
  readonly priceDelta: Amount;
}

export interface CartLine {
  readonly productId: string;
  readonly name: string;
  readonly unitPrice: Amount;
  readonly quantity: number;
  readonly options?: readonly CartLineOption[];
}

export interface ComputedLine extends CartLine {
  /** Prix unitaire suppléments inclus. */
  readonly unitPriceWithOptions: Amount;
  readonly lineTotal: Amount;
}

export type DiscountInput =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'PERCENTAGE'; readonly value: number; readonly label?: string }
  | { readonly kind: 'AMOUNT'; readonly value: Amount; readonly label?: string };

export interface CartInput {
  readonly lines: readonly CartLine[];
  readonly deliveryFee?: Amount;
  readonly discount?: DiscountInput;
  /** Points de fidélité convertis en remise, déjà exprimés en FCFA. */
  readonly loyaltyDiscount?: Amount;
}

export interface CartTotals {
  readonly lines: readonly ComputedLine[];
  readonly itemCount: number;
  readonly subtotal: Amount;
  readonly deliveryFee: Amount;
  readonly discount: Amount;
  readonly loyaltyDiscount: Amount;
  readonly total: Amount;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

function assertQuantity(quantity: number, productId: string): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new PricingError(`quantité invalide pour ${productId} : ${quantity}`);
  }
  if (quantity > 99) {
    throw new PricingError(`quantité irréaliste pour ${productId} : ${quantity}`);
  }
}

export function computeLine(line: CartLine): ComputedLine {
  assertAmount(line.unitPrice, `prix de ${line.name}`);
  assertQuantity(line.quantity, line.productId);

  let unitPriceWithOptions = line.unitPrice;
  for (const option of line.options ?? []) {
    assertAmount(option.priceDelta, `supplément ${option.name}`);
    unitPriceWithOptions += option.priceDelta;
  }

  return {
    ...line,
    unitPriceWithOptions,
    lineTotal: unitPriceWithOptions * line.quantity,
  };
}

/**
 * Ordre de calcul, volontairement figé :
 *   sous-total → remise promotionnelle → remise fidélité → frais de livraison.
 *
 * Les frais de livraison viennent en dernier et ne sont jamais remisés : ils rémunèrent le livreur,
 * pas la marge du restaurant.
 */
export function computeCart(input: CartInput): CartTotals {
  const lines = input.lines.map(computeLine);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const deliveryFee = input.deliveryFee ?? 0;
  assertAmount(deliveryFee, 'frais de livraison');

  const discount = resolveDiscount(subtotal, input.discount ?? { kind: 'NONE' });
  const afterDiscount = subtractFloor(subtotal, discount);

  const requestedLoyalty = input.loyaltyDiscount ?? 0;
  assertAmount(requestedLoyalty, 'remise fidélité');
  const loyaltyDiscount = Math.min(requestedLoyalty, afterDiscount);

  const total = subtractFloor(afterDiscount, loyaltyDiscount) + deliveryFee;

  return { lines, itemCount, subtotal, deliveryFee, discount, loyaltyDiscount, total };
}

function resolveDiscount(subtotal: Amount, discount: DiscountInput): Amount {
  switch (discount.kind) {
    case 'NONE':
      return 0;
    case 'PERCENTAGE':
      return applyPercentage(subtotal, discount.value);
    case 'AMOUNT':
      assertAmount(discount.value, 'remise');
      return Math.min(discount.value, subtotal);
  }
}

/**
 * Compare le total annoncé par le client au total calculé par le serveur.
 * Toute divergence est refusée : c'est le seul endroit du système où un mensonge rapporte de l'argent.
 */
export function totalsMatch(expected: Amount, computed: Amount): boolean {
  return isSameAmount(expected, computed);
}

function isSameAmount(a: Amount, b: Amount): boolean {
  assertAmount(a, 'total annoncé');
  assertAmount(b, 'total calculé');
  return a === b;
}

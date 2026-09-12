import { describe, expect, it } from 'vitest';
import { computeCart, computeLine, PricingError, totalsMatch, type CartLine } from './pricing.js';

const doubleCheese: CartLine = {
  productId: 'p1',
  name: 'Double Cheese',
  unitPrice: 3500,
  quantity: 1,
};

describe('calcul d\'une ligne', () => {
  it('additionne les suppléments au prix unitaire avant de multiplier', () => {
    const line = computeLine({
      ...doubleCheese,
      quantity: 2,
      options: [
        { id: 'o1', name: 'Sauce maison', priceDelta: 0 },
        { id: 'o2', name: 'Bacon', priceDelta: 500 },
      ],
    });
    expect(line.unitPriceWithOptions).toBe(4000);
    expect(line.lineTotal).toBe(8000);
  });

  it('refuse une quantité nulle, négative ou fractionnaire', () => {
    expect(() => computeLine({ ...doubleCheese, quantity: 0 })).toThrow(PricingError);
    expect(() => computeLine({ ...doubleCheese, quantity: -1 })).toThrow(PricingError);
    expect(() => computeLine({ ...doubleCheese, quantity: 1.5 })).toThrow(PricingError);
  });
});

describe('totaux du panier (critère A4)', () => {
  it('reproduit exactement le panier de la maquette', () => {
    // Maquette : sous-total 6 000 F + livraison 1 000 F = 7 000 F
    const totals = computeCart({
      lines: [
        { productId: 'p1', name: 'Double Cheese', unitPrice: 3500, quantity: 1 },
        { productId: 'p2', name: 'Frites', unitPrice: 1500, quantity: 1 },
        { productId: 'p3', name: 'Coca-Cola', unitPrice: 1000, quantity: 1 },
      ],
      deliveryFee: 1000,
    });
    expect(totals.subtotal).toBe(6000);
    expect(totals.deliveryFee).toBe(1000);
    expect(totals.total).toBe(7000);
    expect(totals.itemCount).toBe(3);
  });

  it('applique la remise avant la fidélité, et les frais de livraison en dernier', () => {
    const totals = computeCart({
      lines: [doubleCheese],
      deliveryFee: 1000,
      discount: { kind: 'PERCENTAGE', value: 10 },
      loyaltyDiscount: 200,
    });
    // 3 500 − 350 = 3 150 ; − 200 = 2 950 ; + 1 000 de livraison = 3 950
    expect(totals.discount).toBe(350);
    expect(totals.loyaltyDiscount).toBe(200);
    expect(totals.total).toBe(3950);
  });

  it('ne remise jamais les frais de livraison : ils rémunèrent le livreur', () => {
    const totals = computeCart({
      lines: [doubleCheese],
      deliveryFee: 1000,
      discount: { kind: 'PERCENTAGE', value: 100 },
    });
    expect(totals.total).toBe(1000);
  });

  it('plafonne la remise fidélité au montant restant dû', () => {
    const totals = computeCart({ lines: [doubleCheese], loyaltyDiscount: 999999 });
    expect(totals.loyaltyDiscount).toBe(3500);
    expect(totals.total).toBe(0);
  });

  it('plafonne une remise en montant au sous-total', () => {
    const totals = computeCart({
      lines: [doubleCheese],
      discount: { kind: 'AMOUNT', value: 10000 },
    });
    expect(totals.discount).toBe(3500);
    expect(totals.total).toBe(0);
  });

  it('produit toujours un total entier, quelles que soient les remises', () => {
    const totals = computeCart({
      lines: [{ productId: 'p', name: 'Menu', unitPrice: 3333, quantity: 3 }],
      discount: { kind: 'PERCENTAGE', value: 33 },
    });
    expect(Number.isInteger(totals.total)).toBe(true);
  });
});

describe('contrôle du total annoncé (critère A10)', () => {
  it('refuse un total client inférieur au total serveur', () => {
    expect(totalsMatch(1, 7000)).toBe(false);
    expect(totalsMatch(7000, 7000)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CommissionError,
  DEFAULT_BILLABLE_CHANNELS,
  DEFAULT_RATE_BPS,
  assertRateBps,
  commissionBase,
  commissionFor,
  computeCommission,
  formatRate,
  isBillable,
  periodBounds,
  periodKey,
  periodLabel,
  totalDue,
  type CommissionPlan,
} from './commission.js';

const PLAN: CommissionPlan = {
  rateBps: DEFAULT_RATE_BPS,
  billableChannels: DEFAULT_BILLABLE_CHANNELS,
  period: 'MONTHLY',
};

describe('taux', () => {
  it('exprime 1 % par cent points de base', () => {
    expect(DEFAULT_RATE_BPS).toBe(100);
    expect(formatRate(100)).toBe('1 %');
  });

  it('écrit les taux fractionnaires à la virgule, comme on les lit ici', () => {
    expect(formatRate(150)).toBe('1,5 %');
    expect(formatRate(50)).toBe('0,5 %');
  });

  it('refuse un taux en flottant : un taux à virgule produirait des francs à virgule', () => {
    expect(() => assertRateBps(0.01)).toThrow(CommissionError);
  });

  it('refuse un taux aberrant plutôt que de facturer 300 % en silence', () => {
    expect(() => assertRateBps(30_000)).toThrow(CommissionError);
    expect(() => assertRateBps(-100)).toThrow(CommissionError);
  });
});

describe('assiette', () => {
  it('ne commissionne que les produits, jamais la livraison', () => {
    // Les frais de livraison traversent la caisse pour aller au livreur : ce n'est pas un revenu.
    expect(commissionBase({ channel: 'APP', subtotal: 3500, deliveryFee: 1000 })).toBe(3500);
  });

  it('retire les remises : on ne facture pas un pourcentage d\'argent jamais encaissé', () => {
    expect(commissionBase({ channel: 'APP', subtotal: 5000, discount: 500 })).toBe(4500);
    expect(commissionBase({ channel: 'APP', subtotal: 5000, loyaltyDiscount: 1000 })).toBe(4000);
    expect(commissionBase({ channel: 'APP', subtotal: 5000, discount: 500, loyaltyDiscount: 1000 })).toBe(3500);
  });

  it('ne descend jamais sous zéro, même si les remises dépassent le sous-total', () => {
    expect(commissionBase({ channel: 'APP', subtotal: 1000, discount: 5000 })).toBe(0);
  });
});

describe('canaux facturables', () => {
  it('facture ce que l\'application a réellement apporté', () => {
    expect(isBillable({ channel: 'APP', subtotal: 1000 }, PLAN)).toBe(true);
    expect(isBillable({ channel: 'QR_TABLE', subtotal: 1000 }, PLAN)).toBe(true);
  });

  it('ne facture pas une vente au comptoir', () => {
    // Le jour où saisir une vente au comptoir coûte de l'argent, l'équipe cesse de les saisir :
    // le chiffre d'affaires devient faux et le logiciel perd sa raison d'être.
    expect(isBillable({ channel: 'COUNTER', subtotal: 1000 }, PLAN)).toBe(false);
    expect(isBillable({ channel: 'PHONE', subtotal: 1000 }, PLAN)).toBe(false);
  });

  it('ne facture rien du tout sur un canal non facturable', () => {
    const line = commissionFor({ channel: 'COUNTER', subtotal: 100_000 }, PLAN);
    expect(line).toEqual({ billable: false, base: 0, rateBps: 100, amount: 0 });
  });
});

describe('calcul', () => {
  it('prélève 1 % sur une commande ordinaire', () => {
    expect(computeCommission(3500, 100)).toBe(35);
  });

  it('arrondit au franc, à partir d\'un demi', () => {
    // 1 % de 3 750 F vaut 37,5 F : inscrit à 38 F, une fois pour toutes.
    expect(computeCommission(3750, 100)).toBe(38);
    expect(computeCommission(3740, 100)).toBe(37);
  });

  it('ne rend jamais un montant à virgule', () => {
    for (const base of [1, 7, 33, 149, 1001, 2525, 9999, 123_456]) {
      const amount = computeCommission(base, 100);
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it('ne facture rien sur une commande offerte en totalité', () => {
    expect(commissionFor({ channel: 'APP', subtotal: 2000, discount: 2000 }, PLAN).amount).toBe(0);
  });

  it('inscrit le taux sur la ligne, pour qu\'un changement futur ne réécrive pas le passé', () => {
    const line = commissionFor({ channel: 'APP', subtotal: 10_000 }, { ...PLAN, rateBps: 150 });
    expect(line).toEqual({ billable: true, base: 10_000, rateBps: 150, amount: 150 });
  });
});

describe('périodes', () => {
  const jeudi = new Date('2026-09-17T14:30:00.000Z');

  it('rattache une vente à son jour, sa semaine ou son mois', () => {
    expect(periodKey(jeudi, 'DAILY')).toBe('2026-09-17');
    expect(periodKey(jeudi, 'WEEKLY')).toBe('2026-S38');
    expect(periodKey(jeudi, 'MONTHLY')).toBe('2026-09');
  });

  it('fait commencer la semaine le lundi', () => {
    const { start, end } = periodBounds(jeudi, 'WEEKLY');
    expect(start.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('rattache le dimanche à la semaine qui s\'achève, pas à celle qui commence', () => {
    const dimanche = new Date('2026-09-20T23:00:00.000Z');
    expect(periodBounds(dimanche, 'WEEKLY').start.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('borne le mois du premier au premier', () => {
    const { start, end } = periodBounds(jeudi, 'MONTHLY');
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('passe correctement une fin d\'année', () => {
    const { start, end } = periodBounds(new Date('2026-12-15T10:00:00.000Z'), 'MONTHLY');
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('nomme la période en français, telle qu\'elle figure sur le relevé', () => {
    expect(periodLabel(new Date('2026-09-01T00:00:00Z'), 'MONTHLY')).toBe('septembre 2026');
    expect(periodLabel(new Date('2026-09-14T00:00:00Z'), 'WEEKLY')).toBe('semaine du 14 septembre 2026');
    expect(periodLabel(new Date('2026-09-17T00:00:00Z'), 'DAILY')).toBe('17 septembre 2026');
  });
});

describe('cumul', () => {
  it('additionne les écritures de la période', () => {
    expect(totalDue([{ amount: 35 }, { amount: 50 }, { amount: 12 }])).toBe(97);
  });

  it('soustrait une contre-passation au lieu d\'effacer l\'écriture', () => {
    // Effacer rendrait le relevé impossible à recouper avec l'historique des commandes — soit
    // exactement ce qu'on regarde le jour où quelqu'un conteste un montant.
    expect(totalDue([{ amount: 35 }, { amount: 50 }, { amount: 35, reversed: true }])).toBe(50);
  });

  it('ne réclame jamais un montant négatif', () => {
    expect(totalDue([{ amount: 35 }, { amount: 50, reversed: true }])).toBe(0);
  });

  it('ne doit rien quand il ne s\'est rien passé', () => {
    expect(totalDue([])).toBe(0);
  });
});

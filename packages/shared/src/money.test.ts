import { describe, expect, it } from 'vitest';
import {
  applyPercentage,
  assertAmount,
  formatAmount,
  isAmount,
  MoneyError,
  roundToCashUnit,
  subtractFloor,
  sumAmounts,
  THIN_NBSP,
} from './money.js';

describe('montants en FCFA (critère A13)', () => {
  it('accepte les entiers positifs', () => {
    expect(isAmount(0)).toBe(true);
    expect(isAmount(3500)).toBe(true);
  });

  it('refuse tout montant à virgule — le FCFA n\'a pas de sous-unité', () => {
    expect(isAmount(3500.5)).toBe(false);
    expect(() => assertAmount(0.1 + 0.2, 'total')).toThrow(MoneyError);
  });

  it('refuse les montants négatifs, NaN et Infinity', () => {
    expect(isAmount(-1)).toBe(false);
    expect(() => assertAmount(Number.NaN)).toThrow(MoneyError);
    expect(() => assertAmount(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
    expect(() => assertAmount('3500')).toThrow(MoneyError);
  });

  it('additionne en validant chaque terme', () => {
    expect(sumAmounts([3500, 1500, 1000])).toBe(6000);
    expect(() => sumAmounts([3500, 1500.5])).toThrow(MoneyError);
  });
});

describe('remises', () => {
  it('arrondit au franc inférieur, au bénéfice du client', () => {
    // 10 % de 3 505 F = 350,5 F → 350 F de remise, donc un franc laissé au client.
    expect(applyPercentage(3505, 10)).toBe(350);
  });

  it('refuse un pourcentage hors bornes', () => {
    expect(() => applyPercentage(1000, 120)).toThrow(MoneyError);
    expect(() => applyPercentage(1000, -5)).toThrow(MoneyError);
  });

  it('ne fait jamais passer un total sous zéro', () => {
    expect(subtractFloor(1000, 2500)).toBe(0);
  });
});

describe('affichage', () => {
  it('groupe les milliers et suffixe la devise', () => {
    const s = THIN_NBSP;
    expect(formatAmount(3500)).toBe(`3${s}500${s}F`);
    expect(formatAmount(186500)).toBe(`186${s}500${s}F`);
    expect(formatAmount(500)).toBe(`500${s}F`);
    expect(formatAmount(0)).toBe(`0${s}F`);
  });

  it('s\'appuie sur une espace ins\u00e9cable, jamais une espace ordinaire', () => {
    // Un montant coup\u00e9 entre \u00ab 3 \u00bb et \u00ab 500 F \u00bb en fin de ligne est illisible sur un \u00e9cran de 360 px.
    expect(formatAmount(3500)).not.toContain(' ');
    expect(formatAmount(3500)).toContain(THIN_NBSP);
  });

  it('arrondit au multiple de 5 F, la plus petite coupure du comptoir', () => {
    expect(roundToCashUnit(3502)).toBe(3500);
    expect(roundToCashUnit(3503)).toBe(3505);
  });
});

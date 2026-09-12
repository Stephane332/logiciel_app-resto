import { describe, expect, it } from 'vitest';
import {
  formatOrderNumber,
  generatePickupCode,
  generateTableToken,
  isValidPickupCode,
  normalizePickupCode,
} from './codes.js';

describe('code de retrait', () => {
  it('produit un code de la bonne longueur et du bon alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generatePickupCode();
      expect(code).toHaveLength(5);
      expect(isValidPickupCode(code)).toBe(true);
    }
  });

  it('exclut les caractères qui se confondent à l\'oral comme à l\'œil', () => {
    const codes = Array.from({ length: 500 }, () => generatePickupCode()).join('');
    for (const ambiguous of ['0', 'O', '1', 'I', 'L', '5', 'S', 'B']) {
      expect(codes).not.toContain(ambiguous);
    }
  });

  it('corrige les confusions de saisie au comptoir plutôt que de les rejeter', () => {
    expect(normalizePickupCode('g7k29')).toBe('G7K29');
    expect(normalizePickupCode('g7 k29')).toBe('G7K29');
    expect(normalizePickupCode('G7K2O')).toBe('G7K2D');
  });

  it('ne génère pas deux fois le même code sur un petit tirage', () => {
    const codes = new Set(Array.from({ length: 300 }, () => generatePickupCode()));
    expect(codes.size).toBeGreaterThan(290);
  });
});

describe('jeton de table (critère A11)', () => {
  it('produit un jeton long, opaque et non dérivé du numéro de table', () => {
    const token = generateTableToken();
    expect(token).toHaveLength(22);
    expect(token).not.toMatch(/^table/i);
  });

  it('ne répète pas ses jetons', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateTableToken()));
    expect(tokens.size).toBe(500);
  });
});

describe('numéro de commande', () => {
  it('affiche un numéro court, lisible à voix haute', () => {
    expect(formatOrderNumber(254)).toBe('#254');
    expect(formatOrderNumber(7)).toBe('#007');
  });
});

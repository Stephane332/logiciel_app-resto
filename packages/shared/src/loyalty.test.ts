import { describe, expect, it } from 'vitest';
import { DEFAULT_LOYALTY, pointsEarned, redeemPoints } from './loyalty.js';

describe('points gagnés (critère A16)', () => {
  it('crédite un point par tranche de 100 F', () => {
    expect(pointsEarned(6000)).toBe(60);
    expect(pointsEarned(3550)).toBe(35);
  });

  it('ne crédite rien sous le seuil d\'une tranche', () => {
    expect(pointsEarned(99)).toBe(0);
    expect(pointsEarned(0)).toBe(0);
  });
});

describe('utilisation des points', () => {
  it('refuse en dessous du palier minimum', () => {
    const result = redeemPoints({ balance: 100, pointsToUse: 50, eligibleAmount: 5000 });
    expect(result.ok).toBe(false);
  });

  it('refuse de dépenser plus de points qu\'on en possède', () => {
    const result = redeemPoints({ balance: 600, pointsToUse: 900, eligibleAmount: 5000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('insuffisant');
  });

  it('plafonne la remise à la moitié du montant éligible', () => {
    const result = redeemPoints({ balance: 5000, pointsToUse: 5000, eligibleAmount: 4000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount).toBe(2000);
      expect(result.pointsUsed).toBe(2000);
    }
  });

  it('convertit les points au taux configuré', () => {
    const result = redeemPoints(
      { balance: 1000, pointsToUse: 600, eligibleAmount: 10000 },
      { ...DEFAULT_LOYALTY, pointValue: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discount).toBe(1200);
  });

  it('refuse un nombre de points nul ou fractionnaire', () => {
    expect(redeemPoints({ balance: 900, pointsToUse: 0, eligibleAmount: 5000 }).ok).toBe(false);
    expect(redeemPoints({ balance: 900, pointsToUse: 1.5, eligibleAmount: 5000 }).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  availableTransitions,
  checkTransition,
  initialStatus,
  isTerminal,
  statusLabel,
  trackingProgress,
  trackingSteps,
  TransitionError,
} from './order-status.js';

describe('parcours nominal (critère A2)', () => {
  it('mène une commande de retrait jusqu\'à sa récupération', () => {
    const ctx = { type: 'PICKUP', actor: 'CASHIER' } as const;
    expect(checkTransition('PENDING', 'ACCEPTED', ctx).ok).toBe(true);
    expect(checkTransition('ACCEPTED', 'PREPARING', ctx).ok).toBe(true);
    expect(checkTransition('PREPARING', 'READY', ctx).ok).toBe(true);
    expect(checkTransition('READY', 'PICKED_UP', ctx).ok).toBe(true);
    expect(checkTransition('PICKED_UP', 'COMPLETED', ctx).ok).toBe(true);
  });

  it('mène une livraison jusqu\'à la remise au client', () => {
    const staff = { type: 'DELIVERY', actor: 'CASHIER' } as const;
    const rider = { type: 'DELIVERY', actor: 'DELIVERY' } as const;
    expect(checkTransition('READY', 'ASSIGNED', staff).ok).toBe(true);
    expect(checkTransition('ASSIGNED', 'OUT_FOR_DELIVERY', rider).ok).toBe(true);
    expect(checkTransition('OUT_FOR_DELIVERY', 'DELIVERED', rider).ok).toBe(true);
  });

  it('sert une commande sur place', () => {
    const ctx = { type: 'DINE_IN', actor: 'KITCHEN' } as const;
    expect(checkTransition('READY', 'SERVED', ctx).ok).toBe(true);
  });
});

describe('transitions interdites (critère A8)', () => {
  it('refuse de sauter la préparation', () => {
    const check = checkTransition('PENDING', 'READY', { type: 'PICKUP', actor: 'MANAGER' });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.refusal.code).toBe('UNKNOWN_TRANSITION');
  });

  it('refuse de revenir en arrière', () => {
    const check = checkTransition('READY', 'PREPARING', { type: 'PICKUP', actor: 'MANAGER' });
    expect(check.ok).toBe(false);
  });

  it('refuse toute suite à une commande close', () => {
    const check = checkTransition('COMPLETED', 'PREPARING', { type: 'PICKUP', actor: 'ADMIN' });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.refusal.code).toBe('TERMINAL');
  });

  it('cloisonne les statuts par mode : pas de livraison pour un retrait', () => {
    const check = checkTransition('READY', 'ASSIGNED', { type: 'PICKUP', actor: 'CASHIER' });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.refusal.code).toBe('WRONG_ORDER_TYPE');
  });

  it('interdit à un client de récupérer lui-même sa commande dans le système', () => {
    const check = checkTransition('READY', 'PICKED_UP', { type: 'PICKUP', actor: 'CLIENT' });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.refusal.code).toBe('FORBIDDEN_ACTOR');
  });

  it('interdit à la cuisine d\'accepter une commande', () => {
    const check = checkTransition('PENDING', 'ACCEPTED', { type: 'PICKUP', actor: 'KITCHEN' });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.refusal.code).toBe('FORBIDDEN_ACTOR');
  });

  it('lève une erreur typée lorsqu\'on force le passage', () => {
    expect(() =>
      assertTransition('PENDING', 'DELIVERED', { type: 'DELIVERY', actor: 'ADMIN' }),
    ).toThrow(TransitionError);
  });
});

describe('motif obligatoire', () => {
  it('refuse un refus sans motif', () => {
    const check = checkTransition('PENDING', 'REJECTED', { type: 'PICKUP', actor: 'CASHIER' });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.refusal.code).toBe('REASON_REQUIRED');
  });

  it('accepte un refus motivé', () => {
    const check = checkTransition('PENDING', 'REJECTED', {
      type: 'PICKUP',
      actor: 'CASHIER',
      reason: 'OUT_OF_STOCK',
    });
    expect(check.ok).toBe(true);
  });

  it('ignore un motif fait d\'espaces', () => {
    const check = checkTransition('PENDING', 'REJECTED', {
      type: 'PICKUP',
      actor: 'CASHIER',
      reason: '   ',
    });
    expect(check.ok).toBe(false);
  });
});

describe('annulation', () => {
  it('laisse le client annuler tant que rien n\'est lancé', () => {
    expect(checkTransition('PENDING', 'CANCELLED', { type: 'PICKUP', actor: 'CLIENT' }).ok).toBe(true);
  });

  it('lui refuse l\'annulation une fois la commande acceptée', () => {
    const check = checkTransition('ACCEPTED', 'CANCELLED', { type: 'PICKUP', actor: 'CLIENT' });
    expect(check.ok).toBe(false);
  });
});

describe('canal de commande (ADR 005)', () => {
  it('démarre une commande de comptoir directement en préparation', () => {
    expect(initialStatus('COUNTER')).toBe('PREPARING');
    expect(initialStatus('PHONE')).toBe('PREPARING');
  });

  it('laisse une commande d\'application attendre son acceptation', () => {
    expect(initialStatus('APP')).toBe('PENDING');
    expect(initialStatus('QR_TABLE')).toBe('PENDING');
  });
});

describe('actions proposées à l\'écran', () => {
  it('ne propose à la cuisine que ce qu\'elle peut faire', () => {
    expect(availableTransitions('ACCEPTED', { type: 'PICKUP', actor: 'KITCHEN' })).toEqual(['PREPARING']);
  });

  it('ne propose plus rien sur une commande close', () => {
    expect(availableTransitions('COMPLETED', { type: 'PICKUP', actor: 'ADMIN' })).toEqual([]);
  });
});

describe('suivi côté client', () => {
  it('adapte les étapes au mode de réception', () => {
    expect(trackingSteps('PICKUP')).toContain('PICKED_UP');
    expect(trackingSteps('PICKUP')).not.toContain('OUT_FOR_DELIVERY');
    expect(trackingSteps('DELIVERY')).toContain('OUT_FOR_DELIVERY');
    expect(trackingSteps('DINE_IN')).toContain('SERVED');
  });

  it('situe la commande dans son parcours', () => {
    expect(trackingProgress('PREPARING', 'DELIVERY')).toBe(2);
    expect(trackingProgress('CANCELLED', 'DELIVERY')).toBe(-1);
  });

  it('parle au client en français courant, pas en jargon', () => {
    expect(statusLabel('OUT_FOR_DELIVERY')).toBe('En livraison');
    expect(statusLabel('PENDING')).toBe('Commande envoyée');
  });
});

describe('statuts terminaux', () => {
  it('reconnaît les fins de parcours', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(isTerminal('PREPARING')).toBe(false);
  });
});

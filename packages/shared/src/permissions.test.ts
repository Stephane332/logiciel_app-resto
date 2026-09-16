import { describe, expect, it } from 'vitest';
import { abilitiesFor, assertCan, can, ForbiddenError, isStaff } from './permissions.js';

describe('permissions par rôle (critère A9)', () => {
  it('interdit à la cuisine de modifier un prix', () => {
    expect(can('KITCHEN', 'menu:write')).toBe(false);
    expect(() => assertCan('KITCHEN', 'menu:write')).toThrow(ForbiddenError);
  });

  it('autorise la cuisine à basculer une disponibilité — elle sait ce qui manque', () => {
    expect(can('KITCHEN', 'stock:write')).toBe(true);
  });

  it('interdit au caissier de rembourser', () => {
    expect(can('CASHIER', 'payment:refund')).toBe(false);
    expect(can('MANAGER', 'payment:refund')).toBe(true);
  });

  it('interdit à un client de voir les commandes des autres', () => {
    expect(can('CLIENT', 'order:read:all')).toBe(false);
    expect(can('CLIENT', 'order:read:own')).toBe(true);
  });

  it('interdit au livreur de toucher au menu ou aux statistiques', () => {
    expect(can('DELIVERY', 'menu:write')).toBe(false);
    expect(can('DELIVERY', 'stats:read')).toBe(false);
    expect(can('DELIVERY', 'order:deliver')).toBe(true);
  });

  it('réserve l\'identité de marque et les employés à l\'administrateur', () => {
    expect(can('MANAGER', 'employee:write')).toBe(false);
    expect(can('MANAGER', 'brand:write')).toBe(false);
    expect(can('ADMIN', 'employee:write')).toBe(true);
    expect(can('ADMIN', 'brand:write')).toBe(true);
  });

  it('donne au gérant tout ce que peut la caisse', () => {
    for (const ability of abilitiesFor('CASHIER')) {
      expect(can('MANAGER', ability)).toBe(true);
    }
  });

  it('sépare le client du personnel', () => {
    expect(isStaff('CLIENT')).toBe(false);
    expect(isStaff('KITCHEN')).toBe(true);
  });
});

describe('commission de la plateforme', () => {
  it('reste entre les mains de la direction', () => {
    expect(can('ADMIN', 'commission:read')).toBe(true);
    expect(can('MANAGER', 'commission:read')).toBe(true);
  });

  it('ne concerne ni la cuisine, ni la caisse, ni le livreur — encore moins le client', () => {
    // Ce que le restaurant doit à la plateforme relève du contrat, pas du service.
    expect(can('KITCHEN', 'commission:read')).toBe(false);
    expect(can('CASHIER', 'commission:read')).toBe(false);
    expect(can('DELIVERY', 'commission:read')).toBe(false);
    expect(can('CLIENT', 'commission:read')).toBe(false);
  });
});

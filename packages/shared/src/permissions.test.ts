import { describe, expect, it } from 'vitest';
import { abilitiesFor, assertCan, can, ForbiddenError, homeFor, isStaff } from './permissions.js';

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

  it('ne laisse pas le livreur parcourir toutes les commandes du restaurant', () => {
    // Son téléphone est celui qui circule le plus. Le serveur lui sert sa tournée, filtrée sur son
    // identifiant, et rien d'autre : `GET /delivery/mine`.
    expect(can('DELIVERY', 'order:read:all')).toBe(false);
    expect(can('DELIVERY', 'menu:read')).toBe(false);
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

describe('le tableau de bord de gestion', () => {
  /*
   * Ce groupe existe à cause d'un défaut réel, trouvé en rejouant le parcours de chaque poste.
   *
   * Le tableau de bord — chiffre d'affaires du jour, volumes, alertes — était protégé par
   * `order:read:all`, la capacité qui permet de *voir les commandes*. La cuisine et le livreur en
   * ont besoin pour travailler ; ils recevaient donc les résultats de l'entreprise par-dessus. Lire
   * une commande et lire le chiffre d'affaires sont deux droits différents.
   */
  it('ne montre pas le chiffre d\'affaires à la cuisine', () => {
    expect(can('KITCHEN', 'order:read:all')).toBe(true);
    expect(can('KITCHEN', 'dashboard:read')).toBe(false);
  });

  it('ne le montre pas davantage au livreur ni au client', () => {
    expect(can('DELIVERY', 'dashboard:read')).toBe(false);
    expect(can('CLIENT', 'dashboard:read')).toBe(false);
  });

  it('le laisse au comptoir et à la direction', () => {
    expect(can('CASHIER', 'dashboard:read')).toBe(true);
    expect(can('MANAGER', 'dashboard:read')).toBe(true);
    expect(can('ADMIN', 'dashboard:read')).toBe(true);
  });
});

describe('écran d\'arrivée de chaque poste', () => {
  it('ouvre chaque rôle sur l\'écran depuis lequel il travaille', () => {
    expect(homeFor('CASHIER')).toBe('/');
    expect(homeFor('MANAGER')).toBe('/');
    expect(homeFor('ADMIN')).toBe('/');
    expect(homeFor('KITCHEN')).toBe('/cuisine');
    expect(homeFor('DELIVERY')).toBe('/livraisons');
  });

  it('n\'envoie jamais un rôle sur un écran qu\'il n\'a pas le droit de voir', () => {
    // C'est la garantie qui évite la boucle : être renvoyé d'un écran interdit vers un autre écran
    // interdit, sans fin, sous les yeux de l'employé.
    const ecrans: Record<string, 'dashboard:read' | 'order:prepare' | 'order:deliver'> = {
      '/': 'dashboard:read',
      '/cuisine': 'order:prepare',
      '/livraisons': 'order:deliver',
    };
    for (const role of ['KITCHEN', 'CASHIER', 'DELIVERY', 'MANAGER', 'ADMIN'] as const) {
      const accueil = homeFor(role);
      expect(can(role, ecrans[accueil]!)).toBe(true);
    }
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

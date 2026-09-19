/**
 * Permissions par rôle.
 *
 * Vérifiées côté serveur à chaque requête. Les interfaces s'en servent pour masquer ce qui est
 * interdit — mais ce masquage n'est jamais le mécanisme de sécurité, seulement une politesse.
 */
import type { Role } from './enums.js';

export const ABILITIES = [
  'order:create',
  'order:read:own',
  'order:read:all',
  'order:accept',
  'order:reject',
  'order:prepare',
  'order:ready',
  'order:handover',
  'order:serve',
  'order:assign',
  'order:deliver',
  'order:cancel:any',
  'cashier:register',
  'payment:collect',
  'payment:refund',
  'menu:read',
  'menu:write',
  'stock:write',
  'table:read',
  'table:write',
  'delivery:zone:write',
  'promotion:write',
  'loyalty:adjust',
  'stats:read',
  'employee:write',
  'settings:write',
  'brand:write',
  /// Voir ce que le restaurant doit à la plateforme, et déclarer un reversement (ADR 009).
  /// Réservé à la direction : ce n'est pas l'affaire de la cuisine ni de la caisse.
  'commission:read',
  /**
   * Voir le tableau de bord de gestion : chiffre d'affaires du jour, volumes, alertes.
   *
   * Cette capacité existe parce qu'elle manquait, et que son absence avait une conséquence
   * concrète : le tableau de bord était protégé par `order:read:all`, la même capacité qui permet
   * de *voir les commandes*. La cuisine et le livreur en ont légitimement besoin pour travailler —
   * ils recevaient donc le chiffre d'affaires du restaurant par-dessus. Lire une commande et lire
   * les résultats de l'entreprise sont deux droits différents ; ils ont maintenant deux noms.
   */
  'dashboard:read',
] as const;

export type Ability = (typeof ABILITIES)[number];

const CLIENT: readonly Ability[] = ['order:create', 'order:read:own', 'menu:read'];

const KITCHEN: readonly Ability[] = [
  'order:read:all',
  'order:prepare',
  'order:ready',
  'menu:read',
  'stock:write',
];

const CASHIER: readonly Ability[] = [
  'order:create',
  'order:read:all',
  'order:accept',
  'order:reject',
  'order:prepare',
  'order:ready',
  'order:handover',
  'order:serve',
  'order:assign',
  'cashier:register',
  'dashboard:read',
  'payment:collect',
  'menu:read',
  'stock:write',
  'table:read',
  'table:write',
];

/**
 * Le livreur ne voit que sa tournée.
 *
 * Il avait `order:read:all` et `menu:read` : il pouvait donc parcourir **toutes** les commandes du
 * restaurant depuis son propre téléphone, et la carte avec. Ce n'est pas ce que le cahier des
 * charges décrit, et ce n'est pas défendable — un livreur est souvent le membre le plus
 * périphérique de l'équipe, et son téléphone est celui qui circule le plus.
 *
 * `order:deliver` lui suffit pour annoncer son départ et la remise ; ses courses lui sont servies
 * par `GET /delivery/mine`, filtré sur son identifiant par le serveur.
 */
const DELIVERY: readonly Ability[] = ['order:deliver'];

const MANAGER: readonly Ability[] = [
  ...new Set<Ability>([
    ...CASHIER,
    ...KITCHEN,
    'order:cancel:any',
    'order:deliver',
    'payment:refund',
    'menu:write',
    'delivery:zone:write',
    'promotion:write',
    'loyalty:adjust',
    'stats:read',
    'commission:read',
  ]),
];

const ADMIN: readonly Ability[] = [...ABILITIES];

const MATRIX: Record<Role, readonly Ability[]> = {
  CLIENT,
  KITCHEN,
  CASHIER,
  DELIVERY,
  MANAGER,
  ADMIN,
};

export function abilitiesFor(role: Role): readonly Ability[] {
  return MATRIX[role];
}

export function can(role: Role, ability: Ability): boolean {
  return MATRIX[role].includes(ability);
}

/** Vrai si le rôle donne accès au logiciel restaurant (par opposition à l'application cliente). */
export function isStaff(role: Role): boolean {
  return role !== 'CLIENT';
}

/**
 * L'écran sur lequel un employé arrive en se connectant.
 *
 * Chacun ouvre le logiciel sur l'écran depuis lequel il travaille : la tablette de la cuisine sur
 * la file des plats, le téléphone du livreur sur sa tournée, le comptoir sur le tableau de bord.
 * Ce n'est pas un raffinement — c'est ce qui évite qu'un poste ouvre sur un écran qu'il n'a pas le
 * droit de voir et se fasse renvoyer ailleurs sous les yeux de l'employé.
 *
 * Cette fonction est aussi la cible des redirections : une adresse interdite, tapée à la main ou
 * suivie depuis un vieux favori, ramène ici et non sur un écran refusé à son tour.
 */
export function homeFor(role: Role): string {
  if (can(role, 'dashboard:read')) return '/';
  if (can(role, 'order:prepare')) return '/cuisine';
  if (can(role, 'order:deliver')) return '/livraisons';
  return '/';
}

export class ForbiddenError extends Error {
  readonly ability: Ability;
  readonly role: Role;
  constructor(role: Role, ability: Ability) {
    super(`Le rôle ${role} n'a pas la permission « ${ability} ».`);
    this.name = 'ForbiddenError';
    this.role = role;
    this.ability = ability;
  }
}

export function assertCan(role: Role, ability: Ability): void {
  if (!can(role, ability)) throw new ForbiddenError(role, ability);
}

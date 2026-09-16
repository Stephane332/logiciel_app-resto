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
  'payment:collect',
  'menu:read',
  'stock:write',
  'table:read',
  'table:write',
];

const DELIVERY: readonly Ability[] = ['order:read:all', 'order:deliver', 'menu:read'];

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

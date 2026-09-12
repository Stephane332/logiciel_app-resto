/**
 * Machine à états des commandes.
 *
 * Corrige l'ambiguïté des cahiers des charges antérieurs, qui employaient `PICKED_UP` à la fois pour
 * « le livreur a récupéré la commande » et « le client a récupéré sa commande ». Ici :
 *   - `PICKED_UP` = le client a récupéré sa commande au comptoir ;
 *   - `ASSIGNED`  = la commande est confiée à un livreur.
 *
 * Le serveur est seul juge des transitions. Ce module est partagé pour que les interfaces affichent
 * les bonnes actions — jamais pour qu'elles décident à sa place.
 */
import type { Actor, OrderChannel, OrderStatus, OrderType } from './enums.js';

export interface Transition {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  /** Modes concernés. `null` = tous. */
  readonly types: readonly OrderType[] | null;
  readonly actors: readonly Actor[];
  /** Un motif écrit est exigé pour cette transition. */
  readonly requiresReason?: boolean;
}

const STAFF = ['CASHIER', 'MANAGER', 'ADMIN'] as const;
const KITCHEN_STAFF = ['KITCHEN', 'CASHIER', 'MANAGER', 'ADMIN'] as const;
const SUPERVISORS = ['MANAGER', 'ADMIN'] as const;

export const TRANSITIONS: readonly Transition[] = [
  // --- Tronc commun -------------------------------------------------------
  { from: 'PENDING', to: 'ACCEPTED', types: null, actors: [...STAFF] },
  { from: 'PENDING', to: 'REJECTED', types: null, actors: [...STAFF], requiresReason: true },
  { from: 'PENDING', to: 'CANCELLED', types: null, actors: ['CLIENT', ...STAFF] },
  { from: 'PENDING', to: 'PAYMENT_FAILED', types: null, actors: ['SYSTEM'] },
  { from: 'ACCEPTED', to: 'PREPARING', types: null, actors: [...KITCHEN_STAFF] },
  { from: 'ACCEPTED', to: 'CANCELLED', types: null, actors: [...SUPERVISORS], requiresReason: true },
  { from: 'PREPARING', to: 'READY', types: null, actors: [...KITCHEN_STAFF] },
  { from: 'PREPARING', to: 'CANCELLED', types: null, actors: [...SUPERVISORS], requiresReason: true },

  // --- Retrait ------------------------------------------------------------
  { from: 'READY', to: 'PICKED_UP', types: ['PICKUP'], actors: [...STAFF] },
  { from: 'PICKED_UP', to: 'COMPLETED', types: ['PICKUP'], actors: ['SYSTEM', ...STAFF] },
  { from: 'READY', to: 'EXPIRED', types: ['PICKUP'], actors: ['SYSTEM', ...SUPERVISORS] },

  // --- Sur place ----------------------------------------------------------
  { from: 'READY', to: 'SERVED', types: ['DINE_IN'], actors: [...KITCHEN_STAFF] },
  { from: 'SERVED', to: 'COMPLETED', types: ['DINE_IN'], actors: ['SYSTEM', ...STAFF] },

  // --- Livraison ----------------------------------------------------------
  { from: 'READY', to: 'ASSIGNED', types: ['DELIVERY'], actors: [...STAFF] },
  { from: 'ASSIGNED', to: 'OUT_FOR_DELIVERY', types: ['DELIVERY'], actors: ['DELIVERY', ...STAFF] },
  {
    from: 'OUT_FOR_DELIVERY',
    to: 'DELIVERED',
    types: ['DELIVERY'],
    actors: ['DELIVERY', ...STAFF],
  },
  { from: 'DELIVERED', to: 'COMPLETED', types: ['DELIVERY'], actors: ['SYSTEM', ...STAFF] },
  {
    from: 'ASSIGNED',
    to: 'CANCELLED',
    types: ['DELIVERY'],
    actors: [...SUPERVISORS],
    requiresReason: true,
  },
  {
    from: 'OUT_FOR_DELIVERY',
    to: 'CANCELLED',
    types: ['DELIVERY'],
    actors: [...SUPERVISORS],
    requiresReason: true,
  },
];

/** Statuts dont on ne sort plus : la commande est close, d'une manière ou d'une autre. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'EXPIRED',
];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Statuts pour lesquels la commande occupe encore la cuisine ou le comptoir. */
export const ACTIVE_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
];

export function isActive(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Statut de départ d'une commande selon son canal.
 * Une commande saisie au comptoir est acceptée par définition : l'employé qui la tape est le
 * restaurant. Lui demander de l'accepter ensuite serait une étape absurde en pleine affluence.
 */
export function initialStatus(channel: OrderChannel): OrderStatus {
  return channel === 'COUNTER' || channel === 'PHONE' ? 'PREPARING' : 'PENDING';
}

export interface TransitionContext {
  readonly type: OrderType;
  readonly actor: Actor;
  readonly reason?: string | null;
}

export type TransitionRefusal =
  | { code: 'TERMINAL'; message: string }
  | { code: 'UNKNOWN_TRANSITION'; message: string }
  | { code: 'WRONG_ORDER_TYPE'; message: string }
  | { code: 'FORBIDDEN_ACTOR'; message: string }
  | { code: 'REASON_REQUIRED'; message: string };

export type TransitionCheck = { ok: true } | { ok: false; refusal: TransitionRefusal };

/**
 * Vérifie une transition et explique pourquoi elle est refusée.
 * Le détail du refus compte : « transition interdite » sans raison rend le support impossible.
 */
export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
  context: TransitionContext,
): TransitionCheck {
  if (isTerminal(from)) {
    return {
      ok: false,
      refusal: { code: 'TERMINAL', message: `La commande est close (${from}) : aucune suite possible.` },
    };
  }

  const candidates = TRANSITIONS.filter((t) => t.from === from && t.to === to);
  if (candidates.length === 0) {
    return {
      ok: false,
      refusal: {
        code: 'UNKNOWN_TRANSITION',
        message: `Passage de ${from} à ${to} non prévu par le processus.`,
      },
    };
  }

  const forType = candidates.filter((t) => t.types === null || t.types.includes(context.type));
  if (forType.length === 0) {
    return {
      ok: false,
      refusal: {
        code: 'WRONG_ORDER_TYPE',
        message: `Passage de ${from} à ${to} impossible pour une commande de type ${context.type}.`,
      },
    };
  }

  const allowed = forType.filter((t) => t.actors.includes(context.actor));
  if (allowed.length === 0) {
    return {
      ok: false,
      refusal: {
        code: 'FORBIDDEN_ACTOR',
        message: `Le rôle ${context.actor} n'est pas autorisé à passer la commande de ${from} à ${to}.`,
      },
    };
  }

  const needsReason = allowed.some((t) => t.requiresReason);
  if (needsReason && !context.reason?.trim()) {
    return {
      ok: false,
      refusal: {
        code: 'REASON_REQUIRED',
        message: `Un motif est obligatoire pour passer la commande de ${from} à ${to}.`,
      },
    };
  }

  return { ok: true };
}

export class TransitionError extends Error {
  readonly code: TransitionRefusal['code'];
  constructor(refusal: TransitionRefusal) {
    super(refusal.message);
    this.name = 'TransitionError';
    this.code = refusal.code;
  }
}

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  context: TransitionContext,
): void {
  const check = checkTransition(from, to, context);
  if (!check.ok) throw new TransitionError(check.refusal);
}

/** Actions réellement proposables à cet acteur, pour cette commande, maintenant. */
export function availableTransitions(
  from: OrderStatus,
  context: Omit<TransitionContext, 'reason'>,
): OrderStatus[] {
  if (isTerminal(from)) return [];
  const seen = new Set<OrderStatus>();
  for (const t of TRANSITIONS) {
    if (t.from !== from) continue;
    if (t.types !== null && !t.types.includes(context.type)) continue;
    if (!t.actors.includes(context.actor)) continue;
    seen.add(t.to);
  }
  return [...seen];
}

/** Libellés destinés au client. Langage courant, jamais de jargon technique. */
const CLIENT_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Commande envoyée',
  ACCEPTED: 'Commande confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  ASSIGNED: 'Confiée au livreur',
  OUT_FOR_DELIVERY: 'En livraison',
  DELIVERED: 'Livrée',
  PICKED_UP: 'Récupérée',
  SERVED: 'Servie',
  COMPLETED: 'Terminée',
  REJECTED: 'Refusée',
  CANCELLED: 'Annulée',
  PAYMENT_FAILED: 'Paiement échoué',
  EXPIRED: 'Non récupérée',
};

export function statusLabel(status: OrderStatus): string {
  return CLIENT_LABELS[status];
}

/**
 * Étapes affichées au client pendant le suivi. La dernière étape dépend du mode : un client en
 * retrait n'a que faire d'une étape « en livraison ».
 */
export function trackingSteps(type: OrderType): OrderStatus[] {
  const common: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'];
  switch (type) {
    case 'DELIVERY':
      return [...common, 'OUT_FOR_DELIVERY', 'DELIVERED'];
    case 'PICKUP':
      return [...common, 'PICKED_UP'];
    case 'DINE_IN':
      return [...common, 'SERVED'];
  }
}

/** Position du client dans le suivi : -1 si la commande a quitté le parcours nominal. */
export function trackingProgress(status: OrderStatus, type: OrderType): number {
  return trackingSteps(type).indexOf(status);
}

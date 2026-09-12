/** Énumérations partagées par le backend, les interfaces et la base de données. */

/** Mode de réception choisi par le client. */
export const ORDER_TYPES = ['DELIVERY', 'PICKUP', 'DINE_IN'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/**
 * Origine de la commande. Décisif pour la sincérité du tableau de bord : sans ce champ, le chiffre
 * d'affaires n'inclurait que l'application et ignorerait le comptoir — voir ADR 005.
 */
export const ORDER_CHANNELS = ['APP', 'COUNTER', 'PHONE', 'QR_TABLE'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PICKED_UP',
  'SERVED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'EXPIRED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ROLES = ['CLIENT', 'KITCHEN', 'CASHIER', 'DELIVERY', 'MANAGER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Auteur système : transitions automatiques (expiration, échec de paiement, webhooks). */
export const SYSTEM_ACTOR = 'SYSTEM' as const;
export type Actor = Role | typeof SYSTEM_ACTOR;

export const PAYMENT_METHODS = ['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'MTN_MONEY', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'CONFIRMED',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const TABLE_STATUSES = ['FREE', 'OCCUPIED', 'PREPARING', 'TO_SERVE', 'SERVED'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

/** Motifs de refus. Le motif est obligatoire : « refusée » sans raison est ingérable au support. */
export const REJECTION_REASONS = [
  'OUT_OF_STOCK',
  'TOO_BUSY',
  'CLOSED',
  'OUT_OF_DELIVERY_AREA',
  'INVALID_ORDER',
  'CUSTOMER_REQUEST',
  'OTHER',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

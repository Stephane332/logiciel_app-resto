/**
 * Commission de la plateforme.
 *
 * BaraBite prélève un pourcentage sur les ventes passées par l'application. C'est le modèle
 * économique du logiciel : le restaurant ne paie pas d'abonnement, il paie à l'usage, et seulement
 * quand l'application lui a réellement apporté une vente.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  La plateforme ne touche jamais l'argent. Elle tient un compte, et le dit.    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Ce point n'est pas un choix de confort, c'est une conséquence de l'architecture. Le client paie
 * le restaurant **directement**, de son téléphone au numéro marchand, par code USSD (ADR 008). Il
 * n'y a aucun intermédiaire dans le flux d'argent — c'est justement ce qui permet de se passer d'un
 * agrégateur et de ses commissions. Personne, pas même la plateforme, ne peut donc prélever au
 * passage : il n'y a pas de passage.
 *
 * La commission est donc une **dette enregistrée**, pas un prélèvement. Chaque vente éligible
 * inscrit une écriture ; à la fin de la période, le restaurant reverse le cumul par un simple
 * transfert. Les avantages dépassent d'ailleurs la contrainte : un transfert mensuel coûte les
 * frais d'un transfert, là où trente prélèvements quotidiens de 900 F en coûteraient trente.
 *
 * Ce module ne contient que des fonctions pures. Il ne décide pas quand facturer : il calcule.
 */
import type { OrderChannel } from './enums.js';
import { type Amount, assertAmount } from './money.js';

// ---------------------------------------------------------------------------
// Taux
// ---------------------------------------------------------------------------

/**
 * Un taux s'exprime en **points de base** : 100 pdb = 1 %.
 *
 * Un entier, donc, et jamais 0.01 — un taux en flottant multiplié par un montant produirait des
 * francs à virgule, ce que le système interdit partout ailleurs (ADR 003). Un point de base permet
 * en outre d'écrire 0,5 % ou 1,25 % sans quitter les entiers.
 */
export type RateBps = number;

/** Taux par défaut de la plateforme : 1 %. */
export const DEFAULT_RATE_BPS = 100;

/** Garde-fou : au-delà, c'est une erreur de saisie, pas un contrat. */
export const MAX_RATE_BPS = 3000; // 30 %

export class CommissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommissionError';
  }
}

export function assertRateBps(value: unknown): asserts value is RateBps {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new CommissionError(`Taux invalide : attendu un entier de points de base, reçu ${String(value)}`);
  }
  if (value < 0) throw new CommissionError(`Taux négatif (${value}).`);
  if (value > MAX_RATE_BPS) {
    throw new CommissionError(`Taux de ${formatRate(value)} : au-delà de ${formatRate(MAX_RATE_BPS)}, c'est une erreur de saisie.`);
  }
}

/** « 1 % », « 1,5 % » — tel que le restaurant doit le lire sur son relevé. */
export function formatRate(bps: RateBps): string {
  const percent = bps / 100;
  const text = Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/0$/, '');
  return `${text.replace('.', ',')} %`;
}

// ---------------------------------------------------------------------------
// Assiette
// ---------------------------------------------------------------------------

/** Les canaux facturables par défaut : ceux où le client a commandé depuis son propre téléphone. */
export const DEFAULT_BILLABLE_CHANNELS: readonly OrderChannel[] = ['APP', 'QR_TABLE'];

export interface CommissionPlan {
  rateBps: RateBps;
  /** Canaux sur lesquels la commission s'applique. */
  billableChannels: readonly OrderChannel[];
  /** Périodicité du reversement. */
  period: SettlementPeriod;
}

/** Ce qu'il faut savoir d'une commande pour la facturer — rien de plus. */
export interface BillableOrder {
  channel: OrderChannel;
  /** Montant des produits, avant remises. */
  subtotal: Amount;
  /** Remise commerciale accordée par le restaurant. */
  discount?: Amount;
  /** Remise payée par les points de fidélité. */
  loyaltyDiscount?: Amount;
  /** Frais de livraison : encaissés pour le livreur, jamais dans l'assiette. */
  deliveryFee?: Amount;
}

/**
 * Une commande au comptoir ne doit rien à la plateforme.
 *
 * La tentation serait de facturer aussi les ventes saisies à la caisse — le logiciel les traite
 * après tout. Ce serait une faute, et pas seulement envers le restaurant : le jour où saisir une
 * vente au comptoir coûte de l'argent, l'équipe cesse de les saisir. Le chiffre d'affaires devient
 * faux, les statistiques deviennent fausses, le stock dérive, et le logiciel perd ce qui faisait sa
 * valeur. On ne taxe pas la saisie de ses propres données.
 *
 * La commission rémunère ce que l'application apporte : une commande qu'un client a passée seul,
 * depuis son téléphone.
 */
export function isBillable(order: BillableOrder, plan: CommissionPlan): boolean {
  return plan.billableChannels.includes(order.channel);
}

/**
 * Assiette : ce que le restaurant encaisse réellement pour sa nourriture.
 *
 * Deux exclusions, l'une et l'autre délibérées :
 *   — **les frais de livraison**, qui ne sont pas un revenu : ils traversent la caisse pour aller
 *     au livreur. Les commissionner reviendrait à prélever sur l'argent d'un tiers ;
 *   — **les remises**, commerciales comme fidélité, qui sont de l'argent jamais reçu. Facturer un
 *     pourcentage d'une somme que le restaurant n'a pas encaissée serait indéfendable le jour où
 *     il fait le calcul — et il le fera.
 */
export function commissionBase(order: BillableOrder): Amount {
  assertAmount(order.subtotal, 'sous-total');
  const discount = order.discount ?? 0;
  const loyalty = order.loyaltyDiscount ?? 0;
  assertAmount(discount, 'remise');
  assertAmount(loyalty, 'remise fidélité');

  return Math.max(0, order.subtotal - discount - loyalty);
}

/**
 * Commission due sur une assiette, en francs entiers.
 *
 * L'arrondi se fait au franc supérieur à partir d'un demi. Sur 1 % d'une commande de 3 750 F, la
 * commission théorique vaut 37,5 F : elle est inscrite à 38 F. L'écart est de cinquante centimes
 * sur une monnaie dont la plus petite pièce vaut cinq francs — mais il est inscrit une fois pour
 * toutes, et le même calcul refait un an plus tard donne le même nombre.
 */
export function computeCommission(base: Amount, rateBps: RateBps): Amount {
  assertAmount(base, 'assiette de commission');
  assertRateBps(rateBps);
  return Math.round((base * rateBps) / 10_000);
}

export interface CommissionLine {
  billable: boolean;
  base: Amount;
  rateBps: RateBps;
  amount: Amount;
}

/** Ce que doit une commande, et pourquoi. */
export function commissionFor(order: BillableOrder, plan: CommissionPlan): CommissionLine {
  if (!isBillable(order, plan)) {
    return { billable: false, base: 0, rateBps: plan.rateBps, amount: 0 };
  }
  const base = commissionBase(order);
  return { billable: true, base, rateBps: plan.rateBps, amount: computeCommission(base, plan.rateBps) };
}

// ---------------------------------------------------------------------------
// Périodes de reversement
// ---------------------------------------------------------------------------

export const SETTLEMENT_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type SettlementPeriod = (typeof SETTLEMENT_PERIODS)[number];

/**
 * Clé de la période à laquelle une vente est rattachée.
 *
 * Le Burkina Faso est à l'heure UTC toute l'année : les dates se calculent donc directement, sans
 * décalage ni heure d'été. C'est une simplification réelle, et il faut la dire — la reprendre
 * ailleurs sans y penser serait une erreur.
 */
export function periodKey(date: Date, period: SettlementPeriod): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  switch (period) {
    case 'DAILY':
      return `${year}-${month}-${String(date.getUTCDate()).padStart(2, '0')}`;
    case 'WEEKLY':
      return `${isoWeekYear(date)}-S${String(isoWeek(date)).padStart(2, '0')}`;
    case 'MONTHLY':
      return `${year}-${month}`;
  }
}

/** Bornes de la période contenant cette date, début inclus et fin exclue. */
export function periodBounds(date: Date, period: SettlementPeriod): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  if (period === 'DAILY') {
    return { start, end: addDays(start, 1) };
  }
  if (period === 'WEEKLY') {
    // Semaine ISO : elle commence le lundi, et dimanche vaut 7 et non 0.
    const weekday = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
    const monday = addDays(start, 1 - weekday);
    return { start: monday, end: addDays(monday, 7) };
  }
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return { start: first, end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)) };
}

/** Intitulé lisible d'une période : « septembre 2026 ». */
export function periodLabel(start: Date, period: SettlementPeriod): string {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const month = months[start.getUTCMonth()]!;
  switch (period) {
    case 'DAILY':
      return `${start.getUTCDate()} ${month} ${start.getUTCFullYear()}`;
    case 'WEEKLY':
      return `semaine du ${start.getUTCDate()} ${month} ${start.getUTCFullYear()}`;
    case 'MONTHLY':
      return `${month} ${start.getUTCFullYear()}`;
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function isoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDay = firstThursday.getUTCDay() === 0 ? 7 : firstThursday.getUTCDay();
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstDay);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

function isoWeekYear(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  target.setUTCDate(target.getUTCDate() + 4 - day);
  return target.getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Cumul
// ---------------------------------------------------------------------------

export interface CommissionEntryLike {
  amount: Amount;
  /** Une contre-passation annule une écriture précédente : elle se soustrait. */
  reversed?: boolean;
}

/**
 * Cumul dû sur un ensemble d'écritures.
 *
 * Une vente remboursée ne se supprime pas : elle se contre-passe. Effacer l'écriture rendrait le
 * relevé impossible à recouper avec l'historique des commandes, et c'est exactement ce qu'on
 * regarde le jour où quelqu'un conteste un montant.
 */
export function totalDue(entries: readonly CommissionEntryLike[]): Amount {
  const total = entries.reduce((sum, entry) => sum + (entry.reversed ? -entry.amount : entry.amount), 0);
  return Math.max(0, total);
}

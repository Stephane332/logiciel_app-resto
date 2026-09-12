/**
 * Montants en francs CFA.
 *
 * Le FCFA n'a pas de sous-unité en circulation courante : tous les montants du système sont des
 * entiers de francs. Aucun flottant ne représente jamais un montant — voir ADR 003.
 */

/** Un montant en francs CFA. Toujours un entier. */
export type Amount = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Vrai si la valeur est un montant valide : entier fini et positif ou nul. */
export function isAmount(value: unknown): value is Amount {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Garantit qu'une valeur est un montant exploitable.
 * Échoue bruyamment : un montant douteux qui traverse le système silencieusement finit en écart de
 * caisse inexplicable.
 */
export function assertAmount(value: unknown, label = 'montant'): asserts value is Amount {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MoneyError(`${label} : valeur non numérique (${String(value)})`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} : les montants en FCFA sont des entiers, reçu ${value}`);
  }
  if (value < 0) {
    throw new MoneyError(`${label} : montant négatif (${value})`);
  }
}

/** Additionne des montants en vérifiant chaque terme. */
export function sumAmounts(amounts: readonly Amount[], label = 'montant'): Amount {
  let total = 0;
  for (const amount of amounts) {
    assertAmount(amount, label);
    total += amount;
  }
  return total;
}

/**
 * Applique un pourcentage de remise, arrondi à l'entier inférieur.
 * L'arrondi va au bénéfice du client : mieux vaut offrir un franc que d'en réclamer un.
 */
export function applyPercentage(amount: Amount, percentage: number): Amount {
  assertAmount(amount);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new MoneyError(`pourcentage hors bornes : ${percentage}`);
  }
  return Math.floor((amount * percentage) / 100);
}

/** Soustrait sans jamais passer sous zéro : une commande ne peut pas coûter un montant négatif. */
export function subtractFloor(amount: Amount, deduction: Amount): Amount {
  assertAmount(amount);
  assertAmount(deduction, 'déduction');
  return Math.max(0, amount - deduction);
}

/**
 * Arrondit au multiple de 5 F le plus proche — la plus petite coupure réellement manipulée au
 * comptoir. Utilisé pour les prix affichés, jamais pour les totaux déjà facturés.
 */
export function roundToCashUnit(amount: Amount, unit = 5): Amount {
  assertAmount(amount);
  if (!Number.isInteger(unit) || unit <= 0) {
    throw new MoneyError(`unité d'arrondi invalide : ${unit}`);
  }
  return Math.round(amount / unit) * unit;
}

/**
 * Séparateur de milliers : espace insécable étroite (U+202F).
 * Nommé explicitement plutôt qu'écrit tel quel : un caractère invisible qui décide d'une égalité
 * dans un test est un piège pour la prochaine personne qui lira ce fichier.
 */
export const THIN_NBSP = '\u202f';

/** Formate un montant pour l'affichage : « 3 500 F », sans coupure possible en fin de ligne. */
export function formatAmount(amount: Amount, currency = 'F'): string {
  assertAmount(amount);
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP);
  return currency ? `${grouped}${THIN_NBSP}${currency}` : grouped;
}

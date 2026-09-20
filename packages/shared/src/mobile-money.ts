/**
 * Mobile Money sans agrégateur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Celui qui paie ne confirme jamais son propre paiement.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Approche éprouvée sur Resto Papou Service (Ouahigouya) et reprise ici. Elle
 * évite tout agrégateur payant — donc tout abonnement et toute commission :
 *
 *   1. Le client compose un code USSD, déjà rempli avec le numéro du marchand
 *      et le montant : son clavier téléphonique s'ouvre, il valide.
 *   2. Il recopie l'identifiant de transaction que l'opérateur lui envoie par
 *      SMS. **C'est une déclaration, pas une preuve** — un client peut mentir.
 *   3. Le restaurant compare avec **son propre SMS**, reçu sur le téléphone du
 *      marchand, et atteste : reçu, ou rien vu.
 *
 * Un client peut écrire n'importe quoi dans le champ « identifiant ». Il ne peut
 * pas faire apparaître un SMS sur le téléphone du patron. Toute la sécurité du
 * dispositif tient dans cette asymétrie : ne l'affaiblissez jamais en ajoutant
 * un bouton « je confirme » côté client.
 *
 * Ce module ne contient que des fonctions pures : la construction du code USSD,
 * la lecture du SMS de l'opérateur, et le rapprochement entre ce SMS et les
 * paiements en attente.
 */
import { type Amount, assertAmount } from './money.js';

// ---------------------------------------------------------------------------
// Codes USSD
// ---------------------------------------------------------------------------

/**
 * Modèles par défaut au Burkina Faso.
 *
 * `{NUM}` reçoit le numéro destinataire, `{MONTANT}` le montant en francs.
 * L'ordre des deux marqueurs **change d'un code à l'autre** : voir le code de
 * transfert plus bas. La substitution se fait donc par nom, jamais par position.
 *
 * **À vérifier auprès de l'opérateur avant le premier encaissement** : les codes
 * changent d'un pays à l'autre, et parfois d'une offre à l'autre. Le menu Orange
 * Money burkinabè comporte d'autres entrées (`*144*3*…#` notamment) : chaque
 * modèle reste un réglage, jamais une valeur écrite en dur.
 */
export const USSD_TEMPLATES = {
  /** Paiement à un marchand : le numéro d'abord, puis le montant. */
  ORANGE_MONEY: '*144*10*{NUM}*{MONTANT}#',
  MOOV_MONEY: '*555*4*1*{NUM}*{MONTANT}#',
  /**
   * Envoi d'argent à une personne, Orange Money Burkina. Sert au reversement de
   * la commission : le restaurant transfère au numéro de la plateforme.
   *
   * Comme pour le code marchand, le numéro vient avant le montant — mais rien ne
   * garantit qu'il en aille de même sur les autres entrées du menu, ni demain.
   * La substitution se fait donc par nom de marqueur, jamais par position : un
   * code construit à l'aveugle enverrait 3 500 F au numéro « 3500 », le code
   * partirait, l'opérateur répondrait, et l'argent n'arriverait nulle part.
   */
  ORANGE_MONEY_TRANSFER: '*144*2*1*{NUM}*{MONTANT}#',
} as const;

export interface UssdInput {
  template: string;
  merchantNumber: string;
  amount: Amount;
}

export class UssdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UssdError';
  }
}

/**
 * Construit le code à composer.
 *
 * Le numéro du marchand est réduit à ses chiffres : un numéro saisi « 76 05 57 92 »
 * dans les réglages produirait sinon un code USSD invalide, et l'échec serait
 * silencieux — le clavier s'ouvrirait sur un code qui ne fait rien.
 */
/**
 * Le numéro tel qu'on le compose ici, sans indicatif.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Le menu de l'opérateur attend huit chiffres. Pas onze.                       │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le reste du système range les numéros sous leur forme internationale — « +22666798031 » — parce
 * que c'est la seule qui ne prête pas à confusion en base. Mais un code USSD n'est pas une base de
 * données : il est composé sur un clavier de téléphone, dans le menu de l'opérateur, qui veut le
 * numéro local.
 *
 * Retirer seulement les espaces produisait donc `*144*10*22666798031*1500#` dès que le numéro
 * marchand portait son indicatif — et un restaurateur l'écrit volontiers ainsi, surtout si rien ne
 * lui dit le contraire. Le code s'ouvrait sur le clavier, l'opérateur le refusait, et le client
 * croyait avoir payé. Un échec silencieux sur le chemin de l'argent.
 *
 * On ne valide pas le numéro plus loin que cela : les numéros marchands ne suivent pas toujours les
 * plages des numéros personnels, et refuser un numéro valide serait pire que de laisser passer un
 * numéro douteux — le restaurateur verrait son moyen de paiement inutilisable sans savoir pourquoi.
 */
function numeroLocal(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, '');
  // « 00226… » puis « 226… » : les deux écritures de l'indicatif, dans cet ordre.
  const sansZeros = chiffres.startsWith('00') ? chiffres.slice(2) : chiffres;
  if (sansZeros.startsWith('226') && sansZeros.length > 8) {
    return sansZeros.slice(3);
  }
  return sansZeros;
}

export function buildUssdCode(input: UssdInput): string {
  assertAmount(input.amount, 'montant du paiement');

  const digits = numeroLocal(input.merchantNumber);
  if (digits.length < 8) {
    throw new UssdError('Numéro marchand incomplet : au moins 8 chiffres attendus.');
  }
  if (!input.template.includes('{NUM}') || !input.template.includes('{MONTANT}')) {
    throw new UssdError('Le modèle USSD doit contenir {NUM} et {MONTANT}.');
  }
  assertNoPinInTemplate(input.template);

  return input.template.replace('{NUM}', digits).replace('{MONTANT}', String(input.amount));
}

/**
 * Refuse tout modèle qui embarquerait un code secret.
 *
 * Certains codes du menu opérateur acceptent le PIN en ligne — le retrait chez un agent s'écrit
 * par exemple `*144*2*3*CodeAgent*Montant*CodePIN#`. Cette forme ne doit jamais entrer ici.
 *
 * Un code USSD construit par le logiciel finit dans un lien `tel:`, donc dans l'historique du
 * navigateur, dans les journaux du serveur, dans une capture d'écran envoyée au support. Un numéro
 * de marchand qui traîne là n'est pas grave : il est public. Un code secret qui traîne là vide un
 * compte. Le PIN se tape sur le clavier de son propriétaire, à la fin, et nulle part ailleurs.
 */
export function assertNoPinInTemplate(template: string): void {
  if (/\{\s*(PIN|CODE_?PIN|SECRET|MDP)\s*\}/i.test(template) || /\bpin\b/i.test(template)) {
    throw new UssdError(
      "Ce modèle USSD contient un code secret. Le PIN se saisit sur le téléphone de son propriétaire, jamais dans un code construit par le logiciel.",
    );
  }
}

/**
 * Lien qui ouvre le clavier téléphonique déjà rempli.
 *
 * Le dièse final doit être encodé : sans cela, le navigateur le prend pour une
 * ancre et tronque le code au moment de l'ouverture.
 */
export function ussdDialLink(code: string): string {
  return `tel:${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------------
// Lecture du SMS de l'opérateur
// ---------------------------------------------------------------------------

export interface SmsReading {
  /** Montant de l'opération, en francs entiers. */
  amount: Amount | null;
  /** Identifiant de transaction, tel que l'opérateur l'a écrit. */
  transactionId: string | null;
}

/**
 * Convertit « 6 000 » ou « 500.00 » en francs.
 *
 * Orange écrit les centimes avec deux décimales : « 500.00 » vaut 500 F. Sans
 * cette distinction, « 6.000 » serait lu 6 francs au lieu de 6 000 — une erreur
 * de facteur mille sur un rapprochement comptable.
 */
function toFrancs(raw: string): Amount | null {
  const clean = raw.replace(/[\s  ]/g, '');

  const withCents = /^(\d+)[.,](\d{1,2})$/.exec(clean);
  if (withCents) return Math.round(Number(`${withCents[1]}.${withCents[2]}`));

  const whole = clean.replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;

  const value = Number(whole);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Extrait montant et identifiant d'un SMS d'opérateur.
 *
 * Format observé au Burkina Faso (Orange Money) :
 *   « Votre paiement de 500.00 FCFA, Frais: 4.3478 FCFA, Taxe: 0.6522 FCFA a
 *     ISSA OUEDRAOGO a ete effectue avec succes. Votre solde est de : 471.9 FCFA.
 *     Trans id: MP260902.0128.19397304. »
 *
 * Le **premier** montant de la phrase est celui de l'opération ; les frais, la
 * taxe et le solde viennent après. L'analyse reste volontairement tolérante :
 * Moov n'écrit pas comme Orange, et les formulations évoluent.
 */
export function readOperatorSms(text: string): SmsReading {
  const amountMatch = /(\d[\d\s  .,]*)\s*(?:FCFA|F\s?CFA|XOF)/i.exec(text);

  const idMatch =
    /(?:trans(?:action)?\s*id|id\s*de\s*(?:la\s*)?transaction|r[ée]f(?:[ée]rence)?)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9.\-_]{5,})/i.exec(
      text,
    );

  return {
    amount: amountMatch?.[1] ? toFrancs(amountMatch[1]) : null,
    // L'opérateur termine sa phrase par un point : il n'appartient pas à l'identifiant.
    transactionId: idMatch?.[1] ? idMatch[1].replace(/\.+$/, '') : null,
  };
}

// ---------------------------------------------------------------------------
// Rapprochement
// ---------------------------------------------------------------------------

export interface PendingPayment {
  id: string;
  amount: Amount;
  /** Identifiant recopié par le client. Déclaration, jamais preuve. */
  declaredReference: string | null;
  createdAt: string | Date;
}

export type SmsMatch<T extends PendingPayment = PendingPayment> =
  | { kind: 'UNREADABLE' }
  | { kind: 'NO_MATCH'; amount: Amount | null }
  | { kind: 'MATCHED'; payment: T; byReference: boolean }
  | { kind: 'AMBIGUOUS'; candidates: T[]; amount: Amount };

/** Compare deux identifiants en ignorant espaces et casse. */
function sameReference(a: string, b: string): boolean {
  return a.replace(/\s/g, '').toLowerCase() === b.replace(/\s/g, '').toLowerCase();
}

/**
 * Cherche le paiement que ce SMS règle.
 *
 * L'identifiant prime sur le montant : deux clients peuvent commander le même
 * plat à la même minute, mais deux transactions ne portent jamais le même
 * numéro. Quand seul le montant correspond et qu'il correspond à plusieurs
 * paiements, on refuse de choisir — attester au hasard reviendrait à déclarer
 * payée une commande qui ne l'est pas.
 */
export function matchSmsToPayment<T extends PendingPayment>(
  text: string,
  pending: readonly T[],
): SmsMatch<T> {
  const { amount, transactionId } = readOperatorSms(text);
  if (amount === null && !transactionId) return { kind: 'UNREADABLE' };

  if (transactionId) {
    const byReference = pending.find(
      (payment) => payment.declaredReference && sameReference(payment.declaredReference, transactionId),
    );
    if (byReference) return { kind: 'MATCHED', payment: byReference, byReference: true };
  }

  if (amount === null) return { kind: 'NO_MATCH', amount: null };

  const byAmount = pending.filter((payment) => payment.amount === amount);
  if (byAmount.length === 1) return { kind: 'MATCHED', payment: byAmount[0]!, byReference: false };
  if (byAmount.length > 1) return { kind: 'AMBIGUOUS', candidates: byAmount, amount };

  return { kind: 'NO_MATCH', amount };
}

/**
 * Vérifie la forme d'un identifiant recopié par le client.
 *
 * Volontairement permissif : les formats varient d'un opérateur à l'autre, et
 * refuser une déclaration valable coûterait plus cher qu'en accepter une fausse
 * — de toute façon, seule l'attestation du restaurant fait foi.
 */
export function looksLikeTransactionId(value: string): boolean {
  const clean = value.trim();
  return clean.length >= 6 && clean.length <= 40 && /^[A-Za-z0-9][A-Za-z0-9.\-_ ]*$/.test(clean);
}

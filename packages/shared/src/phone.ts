/**
 * Numéros de téléphone burkinabè.
 *
 * Le téléphone est l'identifiant réel des personnes au Burkina Faso — bien plus que l'adresse
 * électronique. Il mérite donc une normalisation stricte : deux écritures du même numéro ne doivent
 * jamais produire deux comptes.
 */
export const BURKINA_COUNTRY_CODE = '226';

/** Longueur nationale : 8 chiffres. */
const NATIONAL_LENGTH = 8;

export interface PhoneParseResult {
  readonly ok: boolean;
  /** Forme canonique stockée en base : « +22670123456 ». */
  readonly e164?: string;
  readonly national?: string;
  readonly reason?: string;
}

export function parseBurkinaPhone(input: string): PhoneParseResult {
  const digits = input.replace(/[^\d+]/g, '');
  let national = digits;

  if (national.startsWith('+')) national = national.slice(1);
  if (national.startsWith('00')) national = national.slice(2);
  if (national.startsWith(BURKINA_COUNTRY_CODE)) {
    national = national.slice(BURKINA_COUNTRY_CODE.length);
  }

  if (!/^\d+$/.test(national)) {
    return { ok: false, reason: 'Le numéro contient des caractères non numériques.' };
  }
  if (national.length !== NATIONAL_LENGTH) {
    return {
      ok: false,
      reason: `Un numéro burkinabè compte ${NATIONAL_LENGTH} chiffres, reçu ${national.length}.`,
    };
  }

  return { ok: true, e164: `+${BURKINA_COUNTRY_CODE}${national}`, national };
}

export function isValidBurkinaPhone(input: string): boolean {
  return parseBurkinaPhone(input).ok;
}

/** Affichage lisible : « 70 12 34 56 ». */
export function formatBurkinaPhone(input: string): string {
  const parsed = parseBurkinaPhone(input);
  if (!parsed.ok || !parsed.national) return input;
  return parsed.national.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

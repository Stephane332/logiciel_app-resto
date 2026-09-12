/**
 * Codes et identifiants lisibles à voix haute.
 *
 * Contrainte de terrain : ces codes sont dictés au comptoir, parfois dans le bruit. L'alphabet exclut
 * donc les caractères qui se confondent à l'oreille ou à l'œil — 0/O, 1/I/L, 5/S, 8/B.
 */
const UNAMBIGUOUS = 'ACDEFGHJKMNPQRTUVWXYZ2346789';

/**
 * Surface minimale de l'API Web Crypto dont ce module a besoin.
 * Déclarée ici plutôt qu'importée de la bibliothèque DOM : ce paquet tourne aussi bien dans Node
 * que dans un navigateur, et ne doit dépendre ni de l'un ni de l'autre.
 */
interface CryptoLike {
  getRandomValues?<T extends Uint32Array>(array: T): T;
  randomUUID?(): string;
}

function webCrypto(): CryptoLike | undefined {
  return (globalThis as { crypto?: CryptoLike }).crypto;
}

export const PICKUP_CODE_LENGTH = 5;

type RandomSource = (max: number) => number;

const defaultRandom: RandomSource = (max) => {
  const globalCrypto = webCrypto();
  if (globalCrypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    // Rejet des valeurs du dernier intervalle incomplet, pour éviter un biais modulo.
    const limit = Math.floor(0xffffffff / max) * max;
    let value: number;
    do {
      globalCrypto.getRandomValues(buffer);
      value = buffer[0] ?? 0;
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
};

/** Code de retrait, par exemple « G7K29 ». */
export function generatePickupCode(
  length = PICKUP_CODE_LENGTH,
  random: RandomSource = defaultRandom,
): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += UNAMBIGUOUS[random(UNAMBIGUOUS.length)];
  }
  return code;
}

export function isValidPickupCode(code: string, length = PICKUP_CODE_LENGTH): boolean {
  if (code.length !== length) return false;
  return [...code].every((char) => UNAMBIGUOUS.includes(char));
}

/**
 * Normalise un code saisi au comptoir : minuscules acceptées, et confusions courantes corrigées
 * plutôt que rejetées. Un employé pressé ne doit pas se battre avec un champ de saisie.
 */
export function normalizePickupCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/0/g, 'D')
    .replace(/[1IL]/g, 'J')
    .replace(/O/g, 'D')
    .replace(/5/g, 'X')
    .replace(/B/g, '8');
}

/** Jeton de QR Code de table : opaque, non devinable, jamais dérivé du numéro de table. */
export function generateTableToken(random?: () => string): string {
  if (random) return random();
  const globalCrypto = webCrypto();
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID().replace(/-/g, '').slice(0, 22);
  }
  let token = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 22; i += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

/** Numéro de commande affiché, remis à zéro chaque jour : « #254 ». */
export function formatOrderNumber(dailySequence: number): string {
  return `#${String(dailySequence).padStart(3, '0')}`;
}

import { describe, expect, it } from 'vitest';
import { formatBurkinaPhone, isValidBurkinaPhone, parseBurkinaPhone } from './phone.js';

describe('numéros burkinabè', () => {
  it('ramène toutes les écritures d\'un même numéro à une seule forme', () => {
    const expected = '+22670123456';
    for (const input of [
      '70123456',
      '70 12 34 56',
      '+226 70 12 34 56',
      '0022670123456',
      '226-70-12-34-56',
    ]) {
      expect(parseBurkinaPhone(input).e164).toBe(expected);
    }
  });

  it('refuse un numéro trop court ou trop long', () => {
    expect(isValidBurkinaPhone('7012345')).toBe(false);
    expect(isValidBurkinaPhone('701234567')).toBe(false);
  });

  it('refuse un numéro contenant des lettres', () => {
    expect(isValidBurkinaPhone('70ABC456')).toBe(false);
  });

  it('affiche le numéro par paires, comme on le dicte', () => {
    expect(formatBurkinaPhone('+22670123456')).toBe('70 12 34 56');
  });
});

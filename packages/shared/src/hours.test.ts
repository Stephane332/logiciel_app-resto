import { describe, expect, it } from 'vitest';
import { formatMinutes, isOpen, openingState, type OpeningContext } from './hours.js';

// Le Burkina Faso est à UTC+0 toute l'année : les heures UTC sont les heures locales.
const everyDay = (opensAt: number, closesAt: number) =>
  Array.from({ length: 7 }, (_, weekday) => ({ weekday, opensAt, closesAt }));

const context: OpeningContext = { hours: everyDay(10 * 60, 22 * 60) };

describe('horaires d\'ouverture (critère A12)', () => {
  it('ouvre pendant le service', () => {
    expect(isOpen(context, new Date('2026-09-12T12:30:00Z'))).toBe(true);
  });

  it('ferme avant l\'ouverture et après la fermeture', () => {
    expect(isOpen(context, new Date('2026-09-12T08:00:00Z'))).toBe(false);
    expect(isOpen(context, new Date('2026-09-12T23:30:00Z'))).toBe(false);
  });

  it('gère un service qui franchit minuit', () => {
    const lateNight: OpeningContext = { hours: everyDay(18 * 60, 1 * 60) };
    expect(isOpen(lateNight, new Date('2026-09-12T20:00:00Z'))).toBe(true);
    expect(isOpen(lateNight, new Date('2026-09-13T00:30:00Z'))).toBe(true);
    expect(isOpen(lateNight, new Date('2026-09-13T02:00:00Z'))).toBe(false);
  });

  it('obéit à l\'interrupteur du gérant, horaires ou pas', () => {
    const state = openingState({ ...context, manuallyClosed: true }, new Date('2026-09-12T12:30:00Z'));
    expect(state.open).toBe(false);
    if (!state.open) expect(state.reason).toBe('MANUALLY_CLOSED');
  });

  it('annonce la prochaine ouverture quand c\'est fermé', () => {
    const state = openingState(context, new Date('2026-09-12T08:00:00Z'));
    expect(state.open).toBe(false);
    if (!state.open) expect(state.nextOpening?.opensAt).toBe(600);
  });

  it('respecte un jour de fermeture hebdomadaire', () => {
    const withRestDay: OpeningContext = {
      hours: everyDay(10 * 60, 22 * 60).map((h) => (h.weekday === 1 ? { ...h, closed: true } : h)),
    };
    // 14 septembre 2026 est un lundi.
    expect(isOpen(withRestDay, new Date('2026-09-14T12:00:00Z'))).toBe(false);
    expect(isOpen(withRestDay, new Date('2026-09-15T12:00:00Z'))).toBe(true);
  });
});

describe('affichage des heures', () => {
  it('formate les minutes en heure lisible', () => {
    expect(formatMinutes(1170)).toBe('19:30');
    expect(formatMinutes(600)).toBe('10:00');
  });
});

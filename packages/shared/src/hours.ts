/**
 * Horaires d'ouverture.
 *
 * Cas laissé ouvert par les cahiers des charges antérieurs : hors horaires, la prise de commande est
 * bloquée **côté serveur**, pas seulement masquée dans l'interface.
 */
export interface OpeningHour {
  /** 0 = dimanche, 6 = samedi — convention de `Date.getDay()`. */
  readonly weekday: number;
  /** Minutes depuis minuit. 19h30 vaut 1170. */
  readonly opensAt: number;
  readonly closesAt: number;
  readonly closed?: boolean;
}

export interface OpeningContext {
  readonly hours: readonly OpeningHour[];
  /** Interrupteur manuel du gérant : ferme immédiatement, quels que soient les horaires. */
  readonly manuallyClosed?: boolean;
  /** Décalage du fuseau en minutes. Le Burkina Faso est à UTC+0, toute l'année. */
  readonly timezoneOffsetMinutes?: number;
}

export type OpeningState =
  | { readonly open: true; readonly closesAt: number }
  | { readonly open: false; readonly reason: 'MANUALLY_CLOSED' | 'OUTSIDE_HOURS'; readonly nextOpening?: { weekday: number; opensAt: number } };

function minutesOfDay(date: Date, offset: number): number {
  const shifted = new Date(date.getTime() + offset * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function weekdayOf(date: Date, offset: number): number {
  return new Date(date.getTime() + offset * 60_000).getUTCDay();
}

/**
 * Gère les services qui franchissent minuit — un fast-food qui ferme à 1h du matin est la règle, pas
 * l'exception. `closesAt` inférieur à `opensAt` signifie « le lendemain ».
 */
function isWithin(minutes: number, hour: OpeningHour): boolean {
  if (hour.closed) return false;
  if (hour.closesAt > hour.opensAt) {
    return minutes >= hour.opensAt && minutes < hour.closesAt;
  }
  return minutes >= hour.opensAt || minutes < hour.closesAt;
}

export function openingState(context: OpeningContext, now: Date = new Date()): OpeningState {
  if (context.manuallyClosed) {
    return { open: false, reason: 'MANUALLY_CLOSED' };
  }

  const offset = context.timezoneOffsetMinutes ?? 0;
  const minutes = minutesOfDay(now, offset);
  const today = weekdayOf(now, offset);

  for (const hour of context.hours) {
    if (hour.weekday === today && isWithin(minutes, hour)) {
      return { open: true, closesAt: hour.closesAt };
    }
    // Service de la veille qui déborde après minuit.
    const yesterday = (today + 6) % 7;
    if (hour.weekday === yesterday && hour.closesAt < hour.opensAt && minutes < hour.closesAt) {
      return { open: true, closesAt: hour.closesAt };
    }
  }

  return { open: false, reason: 'OUTSIDE_HOURS', nextOpening: findNextOpening(context.hours, today, minutes) };
}

function findNextOpening(
  hours: readonly OpeningHour[],
  today: number,
  minutes: number,
): { weekday: number; opensAt: number } | undefined {
  const open = hours.filter((h) => !h.closed);
  if (open.length === 0) return undefined;

  for (let delta = 0; delta < 7; delta += 1) {
    const weekday = (today + delta) % 7;
    const candidates = open
      .filter((h) => h.weekday === weekday && (delta > 0 || h.opensAt > minutes))
      .sort((a, b) => a.opensAt - b.opensAt);
    const next = candidates[0];
    if (next) return { weekday: next.weekday, opensAt: next.opensAt };
  }
  return undefined;
}

export function isOpen(context: OpeningContext, now: Date = new Date()): boolean {
  return openingState(context, now).open;
}

/** « 19:30 » à partir de 1170 minutes. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const WEEKDAY_LABELS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

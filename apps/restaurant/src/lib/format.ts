/** Formats d'affichage. */
import { formatAmount } from '@savora/shared';

export { formatAmount };

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Minutes écoulées depuis un horodatage — le repère de la cuisine. */
export function minutesSince(value: string | Date): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Math.floor((Date.now() - date.getTime()) / 60_000);
}

export function formatOrderNumber(value: number): string {
  return `#${String(value).padStart(3, '0')}`;
}

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Livraison',
  PICKUP: 'Retrait',
  DINE_IN: 'Sur place',
};

const CHANNEL_LABELS: Record<string, string> = {
  APP: 'Application',
  COUNTER: 'Comptoir',
  PHONE: 'Téléphone',
  QR_TABLE: 'QR table',
};

export const typeLabel = (type: string): string => TYPE_LABELS[type] ?? type;
export const channelLabel = (channel: string): string => CHANNEL_LABELS[channel] ?? channel;

/**
 * Accès à l'API pour l'application cliente.
 *
 * Le noyau HTTP et les types vivent dans `@savora/api-client`, partagé avec le logiciel
 * restaurant : une seule implémentation du jeton, du renouvellement de session et de la traduction
 * des erreurs.
 */
import { apiBase } from './server';
import { configureApi as configureCore, customerApi } from '@savora/api-client';

export { ApiError, request } from '@savora/api-client';
export type {
  Address,
  Category,
  DeliveryZone,
  LoyaltyTransaction,
  NotificationView,
  OpeningHour,
  OptionGroup,
  OptionItem,
  Product,
  RestaurantInfo,
  SessionUser,
  OrderItemView,
} from '@savora/api-client';

/** L'application cliente ne voit que la vue restreinte des commandes. */
export type { CustomerOrder as OrderView } from '@savora/api-client';

export function configureApi(options: {
  readToken: () => string | null;
  refreshSession: () => Promise<string | null>;
}): void {
  // Résolue à l'appel et non au chargement du module : dans l'APK, l'adresse peut être saisie
  // après le démarrage de l'application (voir lib/server.ts).
  configureCore({ baseUrl: apiBase(), ...options });
}

export const api = customerApi;

/**
 * Accès à l'API pour l'application cliente.
 *
 * Le noyau HTTP et les types vivent dans `@savora/api-client`, partagé avec le logiciel
 * restaurant : une seule implémentation du jeton, du renouvellement de session et de la traduction
 * des erreurs.
 */
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

/**
 * En web, l'API répond sur le même domaine. Dans l'APK, il n'y a pas de « même domaine » :
 * l'URL doit être absolue, fournie à la construction (voir docs/apk-android.md).
 */
const BASE = import.meta.env.VITE_API_URL || '/api/v1';

export function configureApi(options: {
  readToken: () => string | null;
  refreshSession: () => Promise<string | null>;
}): void {
  configureCore({ baseUrl: BASE, ...options });
}

export const api = customerApi;

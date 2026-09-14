/**
 * Accès à l'API pour l'application cliente.
 *
 * Le noyau HTTP et les types vivent dans `@barabite/api-client`, partagé avec le logiciel
 * restaurant : une seule implémentation du jeton, du renouvellement de session et de la traduction
 * des erreurs.
 */
import { configureApi as configureCore, customerApi } from '@barabite/api-client';
export { ApiError, request } from '@barabite/api-client';
/**
 * En web, l'API répond sur le même domaine. Dans l'APK, il n'y a pas de « même domaine » :
 * l'URL doit être absolue, fournie à la construction (voir docs/apk-android.md).
 */
const BASE = import.meta.env.VITE_API_URL || '/api/v1';
export function configureApi(options) {
    configureCore({ baseUrl: BASE, ...options });
}
export const api = customerApi;
//# sourceMappingURL=api.js.map
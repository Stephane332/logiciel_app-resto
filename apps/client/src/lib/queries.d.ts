/**
 * Accès aux données via React Query.
 *
 * Le paramétrage vise un réseau instable : on sert d'abord ce qu'on a en mémoire, on retente
 * plusieurs fois, et on ne rejoue jamais une requête qui a échoué pour une raison métier.
 */
import { QueryClient } from '@tanstack/react-query';
export declare const queryClient: QueryClient;
export declare const useRestaurant: () => import("@tanstack/react-query").UseQueryResult<import("@barabite/api-client").RestaurantInfo, Error>;
export declare const useMenu: () => import("@tanstack/react-query").UseQueryResult<{
    categories: import("@barabite/api-client").Category[];
}, Error>;
export declare const useProduct: (slug: string | undefined) => import("@tanstack/react-query").UseQueryResult<{
    product: import("@barabite/api-client").Product;
}, Error>;
export declare const useMyOrders: (enabled: boolean) => import("@tanstack/react-query").UseQueryResult<{
    orders: import("@barabite/api-client").CustomerOrder[];
    nextCursor: string | null;
}, Error>;
export declare const useOrder: (id: string | undefined) => import("@tanstack/react-query").UseQueryResult<{
    order: import("@barabite/api-client").CustomerOrder;
}, Error>;
export declare const useAddresses: (enabled: boolean) => import("@tanstack/react-query").UseQueryResult<{
    addresses: import("@barabite/api-client").Address[];
}, Error>;
export declare const useNotifications: (enabled: boolean) => import("@tanstack/react-query").UseQueryResult<{
    notifications: import("@barabite/api-client").NotificationView[];
    unread: number;
}, Error>;
export declare const useLoyalty: (enabled: boolean) => import("@tanstack/react-query").UseQueryResult<{
    balance: number;
    transactions: import("@barabite/api-client").LoyaltyTransaction[];
}, Error>;
//# sourceMappingURL=queries.d.ts.map
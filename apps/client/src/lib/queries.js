/**
 * Accès aux données via React Query.
 *
 * Le paramétrage vise un réseau instable : on sert d'abord ce qu'on a en mémoire, on retente
 * plusieurs fois, et on ne rejoue jamais une requête qui a échoué pour une raison métier.
 */
import { QueryClient, useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
                // Une erreur métier (produit épuisé, zone non desservie) ne se résout pas en réessayant.
                if (error instanceof ApiError && error.status >= 400 && error.status < 500)
                    return false;
                return failureCount < 3;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        },
    },
});
export const useRestaurant = () => useQuery({ queryKey: ['restaurant'], queryFn: api.restaurant, staleTime: 5 * 60_000 });
export const useMenu = () => useQuery({ queryKey: ['menu'], queryFn: api.menu });
export const useProduct = (slug) => useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.product(slug),
    enabled: Boolean(slug),
});
export const useMyOrders = (enabled) => useQuery({ queryKey: ['orders', 'mine'], queryFn: api.myOrders, enabled, staleTime: 15_000 });
export const useOrder = (id) => useQuery({
    queryKey: ['order', id],
    queryFn: () => api.trackOrder(id),
    enabled: Boolean(id),
    staleTime: 5_000,
    // Filet de sécurité si le temps réel ne passe pas : on resynchronise toutes les 20 secondes.
    refetchInterval: 20_000,
});
export const useAddresses = (enabled) => useQuery({ queryKey: ['addresses'], queryFn: api.addresses, enabled });
export const useNotifications = (enabled) => useQuery({ queryKey: ['notifications'], queryFn: api.notifications, enabled, staleTime: 30_000 });
export const useLoyalty = (enabled) => useQuery({ queryKey: ['loyalty'], queryFn: api.loyalty, enabled });
//# sourceMappingURL=queries.js.map
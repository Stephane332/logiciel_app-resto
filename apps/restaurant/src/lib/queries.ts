/** Accès aux données. */
import { QueryClient, useQuery } from '@tanstack/react-query';
import { ApiError, staffApi } from '@barabite/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

/**
 * File des commandes actives.
 * Rechargée régulièrement en plus du temps réel : si le WebSocket tombe sans qu'on s'en aperçoive,
 * la cuisine continue de voir arriver les commandes.
 */
export const useActiveOrders = () =>
  useQuery({
    queryKey: ['orders', 'active'],
    queryFn: () => staffApi.orders({ scope: 'active' }),
    refetchInterval: 20_000,
    staleTime: 5_000,
  });

export const useTodayOrders = () =>
  useQuery({ queryKey: ['orders', 'today'], queryFn: () => staffApi.orders({ scope: 'today' }) });

export const useTodayStats = () =>
  useQuery({ queryKey: ['stats', 'today'], queryFn: staffApi.todayStats, refetchInterval: 60_000 });

export const useRangeStats = (days: number) =>
  useQuery({ queryKey: ['stats', 'range', days], queryFn: () => staffApi.rangeStats(days) });

export const useTopProducts = (days: number) =>
  useQuery({ queryKey: ['stats', 'top', days], queryFn: () => staffApi.topProducts(days) });

export const useRestaurant = () =>
  useQuery({ queryKey: ['restaurant'], queryFn: staffApi.restaurant, staleTime: 60_000 });

export const useManageMenu = () =>
  useQuery({ queryKey: ['menu', 'manage'], queryFn: staffApi.manageMenu, staleTime: 30_000 });

export const useTables = () =>
  useQuery({ queryKey: ['tables'], queryFn: staffApi.tables, refetchInterval: 30_000 });

export const useEmployees = () =>
  useQuery({ queryKey: ['employees'], queryFn: staffApi.employees });

export const useZones = () => useQuery({ queryKey: ['zones'], queryFn: staffApi.zones });

export const useSetupStatus = () =>
  useQuery({ queryKey: ['setup'], queryFn: staffApi.setup, staleTime: 30_000 });

/** Invalide tout ce qui dépend des commandes — appelé à chaque événement temps réel. */
export function refreshOrders(): void {
  void queryClient.invalidateQueries({ queryKey: ['orders'] });
  void queryClient.invalidateQueries({ queryKey: ['stats'] });
  void queryClient.invalidateQueries({ queryKey: ['tables'] });
}

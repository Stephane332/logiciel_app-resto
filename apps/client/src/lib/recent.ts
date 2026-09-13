/**
 * Commandes récentes, mémorisées localement.
 *
 * Un client qui commande sans compte doit pouvoir retrouver sa commande : sans cette mémoire, fermer
 * l'application reviendrait à perdre son numéro et son code de retrait. Rien n'est envoyé au
 * serveur — c'est une commodité locale, pas un compte déguisé.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentOrder {
  id: string;
  number: number;
  total: number;
  createdAt: string;
  type: string;
  pickupCode: string | null;
}

interface RecentState {
  orders: RecentOrder[];
  remember: (order: RecentOrder) => void;
  forget: (id: string) => void;
}

const MAX_REMEMBERED = 20;

export const useRecentOrders = create<RecentState>()(
  persist(
    (set) => ({
      orders: [],
      remember: (order) =>
        set((state) => ({
          orders: [order, ...state.orders.filter((item) => item.id !== order.id)].slice(0, MAX_REMEMBERED),
        })),
      forget: (id) => set((state) => ({ orders: state.orders.filter((item) => item.id !== id) })),
    }),
    { name: 'barabite.recent-orders' },
  ),
);

/**
 * Panier.
 *
 * Persisté : un client qui perd le réseau, ferme l'application ou reçoit un appel en pleine commande
 * doit retrouver son panier intact. Les totaux sont calculés par la fonction partagée avec le
 * serveur — l'écart entre l'affiché et le facturé devient impossible (ADR 002).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { computeCart, type CartLine, type CartTotals, type OrderType } from '@savora/shared';
import type { Product } from './api';

export interface CartItem {
  /** Identifie une ligne : deux fois le même produit avec des options différentes font deux lignes. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  unitPrice: number;
  imageUrl: string | null;
  quantity: number;
  options: { id: string; name: string; priceDelta: number }[];
  note?: string;
}

export interface TableContext {
  token: string;
  number: string;
  expiresAt: string;
}

interface CartState {
  items: CartItem[];
  mode: OrderType | null;
  table: TableContext | null;
  add: (product: Product, options: { id: string; name: string; priceDelta: number }[], quantity: number, note?: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setMode: (mode: OrderType | null) => void;
  setTable: (table: TableContext | null) => void;
}

function lineKey(productId: string, options: { id: string }[]): string {
  return [productId, ...options.map((option) => option.id).sort()].join('|');
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      mode: null,
      table: null,

      add: (product, options, quantity, note) =>
        set((state) => {
          const key = lineKey(product.id, options);
          const existing = state.items.find((item) => item.key === key);

          if (existing) {
            return {
              items: state.items.map((item) =>
                item.key === key
                  ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
                  : item,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                key,
                productId: product.id,
                slug: product.slug,
                name: product.name,
                unitPrice: product.price,
                imageUrl: product.imageUrl,
                quantity,
                options,
                ...(note ? { note } : {}),
              },
            ],
          };
        }),

      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.key !== key)
              : state.items.map((item) =>
                  item.key === key ? { ...item, quantity: Math.min(99, quantity) } : item,
                ),
        })),

      remove: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),

      // La table est conservée : après une commande sur place, on en repasse souvent une seconde.
      clear: () => set({ items: [] }),

      setMode: (mode) => set({ mode }),
      setTable: (table) => set({ table, ...(table ? { mode: 'DINE_IN' as OrderType } : {}) }),
    }),
    { name: 'savora.cart' },
  ),
);

export function toCartLines(items: CartItem[]): CartLine[] {
  return items.map((item) => ({
    productId: item.productId,
    name: item.name,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    options: item.options,
  }));
}

export function cartTotals(
  items: CartItem[],
  extras: { deliveryFee?: number; loyaltyDiscount?: number } = {},
): CartTotals {
  return computeCart({
    lines: toCartLines(items),
    deliveryFee: extras.deliveryFee ?? 0,
    loyaltyDiscount: extras.loyaltyDiscount ?? 0,
  });
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Prix unitaire suppléments compris — ce que le client voit sur la ligne. */
export function itemUnitPrice(item: CartItem): number {
  return item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta, 0);
}

import { type CartLine, type CartTotals, type OrderType } from '@barabite/shared';
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
    options: {
        id: string;
        name: string;
        priceDelta: number;
    }[];
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
    add: (product: Product, options: {
        id: string;
        name: string;
        priceDelta: number;
    }[], quantity: number, note?: string) => void;
    setQuantity: (key: string, quantity: number) => void;
    remove: (key: string) => void;
    clear: () => void;
    setMode: (mode: OrderType | null) => void;
    setTable: (table: TableContext | null) => void;
}
export declare const useCart: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<CartState>, "setState" | "persist"> & {
    setState(partial: CartState | Partial<CartState> | ((state: CartState) => CartState | Partial<CartState>), replace?: false | undefined): unknown;
    setState(state: CartState | ((state: CartState) => CartState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<CartState, CartState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: CartState) => void) => () => void;
        onFinishHydration: (fn: (state: CartState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<CartState, CartState, unknown>>;
    };
}>;
export declare function toCartLines(items: CartItem[]): CartLine[];
export declare function cartTotals(items: CartItem[], extras?: {
    deliveryFee?: number;
    loyaltyDiscount?: number;
}): CartTotals;
export declare function cartItemCount(items: CartItem[]): number;
/** Prix unitaire suppléments compris — ce que le client voit sur la ligne. */
export declare function itemUnitPrice(item: CartItem): number;
export {};
//# sourceMappingURL=cart.d.ts.map
/**
 * Panier.
 *
 * Persisté : un client qui perd le réseau, ferme l'application ou reçoit un appel en pleine commande
 * doit retrouver son panier intact. Les totaux sont calculés par la fonction partagée avec le
 * serveur — l'écart entre l'affiché et le facturé devient impossible (ADR 002).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { computeCart } from '@barabite/shared';
function lineKey(productId, options) {
    return [productId, ...options.map((option) => option.id).sort()].join('|');
}
export const useCart = create()(persist((set) => ({
    items: [],
    mode: null,
    table: null,
    add: (product, options, quantity, note) => set((state) => {
        const key = lineKey(product.id, options);
        const existing = state.items.find((item) => item.key === key);
        if (existing) {
            return {
                items: state.items.map((item) => item.key === key
                    ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
                    : item),
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
    setQuantity: (key, quantity) => set((state) => ({
        items: quantity <= 0
            ? state.items.filter((item) => item.key !== key)
            : state.items.map((item) => item.key === key ? { ...item, quantity: Math.min(99, quantity) } : item),
    })),
    remove: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
    // La table est conservée : après une commande sur place, on en repasse souvent une seconde.
    clear: () => set({ items: [] }),
    setMode: (mode) => set({ mode }),
    setTable: (table) => set({ table, ...(table ? { mode: 'DINE_IN' } : {}) }),
}), { name: 'barabite.cart' }));
export function toCartLines(items) {
    return items.map((item) => ({
        productId: item.productId,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        options: item.options,
    }));
}
export function cartTotals(items, extras = {}) {
    return computeCart({
        lines: toCartLines(items),
        deliveryFee: extras.deliveryFee ?? 0,
        loyaltyDiscount: extras.loyaltyDiscount ?? 0,
    });
}
export function cartItemCount(items) {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}
/** Prix unitaire suppléments compris — ce que le client voit sur la ligne. */
export function itemUnitPrice(item) {
    return item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta, 0);
}
//# sourceMappingURL=cart.js.map
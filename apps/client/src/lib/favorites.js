/** Favoris — purement local : aucune raison d'envoyer ça au serveur en V1. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useFavorites = create()(persist((set, get) => ({
    slugs: [],
    toggle: (slug) => set((state) => ({
        slugs: state.slugs.includes(slug)
            ? state.slugs.filter((item) => item !== slug)
            : [...state.slugs, slug],
    })),
    has: (slug) => get().slugs.includes(slug),
}), { name: 'barabite.favorites' }));
//# sourceMappingURL=favorites.js.map
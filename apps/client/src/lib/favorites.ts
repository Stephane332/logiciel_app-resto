/** Favoris — purement local : aucune raison d'envoyer ça au serveur en V1. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      slugs: [],
      toggle: (slug) =>
        set((state) => ({
          slugs: state.slugs.includes(slug)
            ? state.slugs.filter((item) => item !== slug)
            : [...state.slugs, slug],
        })),
      has: (slug) => get().slugs.includes(slug),
    }),
    { name: 'barabite.favorites' },
  ),
);

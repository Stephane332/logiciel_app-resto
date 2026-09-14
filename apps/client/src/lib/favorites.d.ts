interface FavoritesState {
    slugs: string[];
    toggle: (slug: string) => void;
    has: (slug: string) => boolean;
}
export declare const useFavorites: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<FavoritesState>, "setState" | "persist"> & {
    setState(partial: FavoritesState | Partial<FavoritesState> | ((state: FavoritesState) => FavoritesState | Partial<FavoritesState>), replace?: false | undefined): unknown;
    setState(state: FavoritesState | ((state: FavoritesState) => FavoritesState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<FavoritesState, FavoritesState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: FavoritesState) => void) => () => void;
        onFinishHydration: (fn: (state: FavoritesState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<FavoritesState, FavoritesState, unknown>>;
    };
}>;
export {};
//# sourceMappingURL=favorites.d.ts.map
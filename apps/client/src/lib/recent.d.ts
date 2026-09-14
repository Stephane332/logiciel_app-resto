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
export declare const useRecentOrders: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<RecentState>, "setState" | "persist"> & {
    setState(partial: RecentState | Partial<RecentState> | ((state: RecentState) => RecentState | Partial<RecentState>), replace?: false | undefined): unknown;
    setState(state: RecentState | ((state: RecentState) => RecentState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<RecentState, RecentState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: RecentState) => void) => () => void;
        onFinishHydration: (fn: (state: RecentState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<RecentState, RecentState, unknown>>;
    };
}>;
export {};
//# sourceMappingURL=recent.d.ts.map
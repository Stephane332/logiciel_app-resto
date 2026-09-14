import { type SessionUser } from './api';
interface SessionState {
    user: SessionUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    /** Identité de l'appareil, utilisée pour les sessions de table. Stable et anonyme. */
    deviceId: string;
    setSession: (session: {
        user: SessionUser;
        accessToken: string;
        refreshToken: string;
    }) => void;
    setUser: (user: SessionUser) => void;
    clear: () => void;
}
export declare const useSession: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<SessionState>, "setState" | "persist"> & {
    setState(partial: SessionState | Partial<SessionState> | ((state: SessionState) => SessionState | Partial<SessionState>), replace?: false | undefined): unknown;
    setState(state: SessionState | ((state: SessionState) => SessionState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<SessionState, {
            user: SessionUser | null;
            accessToken: string | null;
            refreshToken: string | null;
            deviceId: string;
        }, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: SessionState) => void) => () => void;
        onFinishHydration: (fn: (state: SessionState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<SessionState, {
            user: SessionUser | null;
            accessToken: string | null;
            refreshToken: string | null;
            deviceId: string;
        }, unknown>>;
    };
}>;
export declare function signOut(): Promise<void>;
export declare function useIsAuthenticated(): boolean;
export {};
//# sourceMappingURL=session.d.ts.map
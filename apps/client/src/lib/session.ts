/**
 * Session utilisateur.
 *
 * Persistée dans le stockage local : sur un téléphone partagé ou une connexion coupée, l'utilisateur
 * ne doit pas se retrouver déconnecté à chaque ouverture.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, configureApi, type SessionUser } from './api';

interface SessionState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Identité de l'appareil, utilisée pour les sessions de table. Stable et anonyme. */
  deviceId: string;
  setSession: (session: { user: SessionUser; accessToken: string; refreshToken: string }) => void;
  setUser: (user: SessionUser) => void;
  clear: () => void;
}

function newDeviceId(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      deviceId: newDeviceId(),
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'barabite.session',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        deviceId: state.deviceId,
      }),
    },
  ),
);

/**
 * Renouvellement de session, mutualisé.
 * Plusieurs requêtes peuvent échouer en 401 simultanément ; sans ce verrou, chacune déclencherait son
 * propre rafraîchissement et les jetons tournants s'invalideraient mutuellement.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const { refreshToken, setSession, clear } = useSession.getState();
  if (!refreshToken) return null;

  refreshInFlight = api
    .refresh(refreshToken)
    .then((result) => {
      setSession(result);
      return result.accessToken;
    })
    .catch(() => {
      clear();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

configureApi({
  readToken: () => useSession.getState().accessToken,
  refreshSession,
});

export async function signOut(): Promise<void> {
  const { refreshToken, clear } = useSession.getState();
  if (refreshToken) {
    // La déconnexion locale ne doit jamais dépendre du réseau.
    await api.logout(refreshToken).catch(() => undefined);
  }
  clear();
}

export function useIsAuthenticated(): boolean {
  return useSession((state) => Boolean(state.user && state.accessToken));
}

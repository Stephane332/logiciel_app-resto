/**
 * Session du personnel.
 *
 * Un poste de caisse ou de cuisine reste allumé toute la journée : la session doit tenir, et se
 * renouveler silencieusement, sans jamais renvoyer un employé à l'écran de connexion en plein service.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { configureApi, staffApi, type SessionUser } from '@savora/api-client';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface SessionState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: { user: SessionUser; accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'savora.staff-session' },
  ),
);

/** Renouvellement mutualisé : plusieurs requêtes peuvent expirer en même temps. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const { refreshToken, setSession, clear } = useSession.getState();
  if (!refreshToken) return null;

  refreshInFlight = staffApi
    .refresh(refreshToken)
    .then((session) => {
      setSession(session);
      return session.accessToken;
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
  baseUrl: BASE,
  readToken: () => useSession.getState().accessToken,
  refreshSession,
});

export async function signOut(): Promise<void> {
  const { refreshToken, clear } = useSession.getState();
  if (refreshToken) await staffApi.logout(refreshToken).catch(() => undefined);
  clear();
}

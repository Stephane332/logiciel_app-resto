/**
 * Noyau HTTP, partagé par l'application cliente et le logiciel restaurant.
 *
 * Écrit une seule fois : la gestion du jeton, le renouvellement de session et la traduction des
 * erreurs sont exactement le genre de logique qui diverge silencieusement quand on la duplique —
 * et dont la divergence se paie en déconnexions inexplicables.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Vrai lorsque l'échec vient du réseau et non du serveur : le message à afficher diffère. */
  get isOffline(): boolean {
    return this.code === 'NETWORK';
  }
}

export interface ApiConfig {
  baseUrl: string;
  readToken: () => string | null;
  refreshSession: () => Promise<string | null>;
}

let config: ApiConfig = {
  baseUrl: '/api/v1',
  readToken: () => null,
  refreshSession: async () => null,
};

export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Interdit le renouvellement automatique, pour éviter une boucle sur la route de rafraîchissement. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = config.readToken();

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Pas de connexion. Vérifiez votre réseau.');
  }

  // Session expirée : on tente un renouvellement silencieux, puis on rejoue la requête une fois.
  if (response.status === 401 && !options.skipRefresh && token) {
    const renewed = await config.refreshSession();
    if (renewed) return request<T>(path, { ...options, skipRefresh: true });
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Une erreur est survenue. Réessayez.',
      error?.details,
    );
  }

  return payload as T;
}

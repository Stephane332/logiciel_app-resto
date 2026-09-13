/**
 * Client HTTP.
 *
 * Un seul point de passage vers l'API : c'est là que se gèrent le jeton, le renouvellement de
 * session et la traduction des erreurs. Les écrans ne voient jamais un `fetch` nu.
 */
import type { OrderChannel, OrderStatus, OrderType, PaymentMethod } from '@barabite/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

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

type TokenReader = () => string | null;
type TokenRefresher = () => Promise<string | null>;

let readToken: TokenReader = () => null;
let refreshSession: TokenRefresher = async () => null;

export function configureApi(options: { readToken: TokenReader; refreshSession: TokenRefresher }): void {
  readToken = options.readToken;
  refreshSession = options.refreshSession;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Interdit le renouvellement automatique, pour éviter une boucle sur la route de rafraîchissement. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken();

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
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
    const renewed = await refreshSession();
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

// ---------------------------------------------------------------------------
// Types de l'API
// ---------------------------------------------------------------------------

export interface OptionItem {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
  position: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
  position: number;
  items: OptionItem[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isOrderable: boolean;
  isFeatured: boolean;
  position: number;
  optionGroups: OptionGroup[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  products: Product[];
}

export interface OpeningHour {
  weekday: number;
  opensAt: number;
  closesAt: number;
  closed: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  minimumOrder: number;
  estimatedMinutes: number;
  isActive: boolean;
}

export interface RestaurantInfo {
  restaurant: {
    id: string;
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    primaryColor: string;
    backgroundColor: string;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    city: string;
    currencySymbol: string;
    preparationMinutes: number;
    modes: { delivery: boolean; pickup: boolean; dineIn: boolean };
    payment: {
      online: boolean;
      cashOnDelivery: boolean;
      cashOnPickup: boolean;
      cashOnDineIn: boolean;
    };
    loyalty: {
      amountPerPoint: number;
      pointValue: number;
      minimumPoints: number;
      maxRedemptionPct: number;
    } | null;
  };
  openingHours: OpeningHour[];
  deliveryZones: DeliveryZone[];
  state:
    | { open: true; closesAt: number }
    | { open: false; reason: string; nextOpening?: { weekday: number; opensAt: number } };
}

export interface OrderItemView {
  id: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  options: { id: string; name: string; priceDelta: number }[];
}

export interface OrderView {
  id: string;
  number: number;
  status: OrderStatus;
  type: OrderType;
  channel: OrderChannel;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  loyaltyDiscount: number;
  total: number;
  pickupCode: string | null;
  createdAt: string;
  note: string | null;
  items: OrderItemView[];
  table: { number: string } | null;
  delivery: { sector: string; landmark: string } | null;
  events?: { status: OrderStatus; createdAt: string; reason: string | null }[];
  payment: { method: PaymentMethod; status: string } | null;
}

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  loyaltyPoints: number;
  marketingConsent: boolean;
}

export interface Address {
  id: string;
  label: string | null;
  sector: string;
  district: string | null;
  landmark: string;
  details: string | null;
  isDefault: boolean;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  points: number;
  reason: string;
  balance: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Points d'entrée
// ---------------------------------------------------------------------------

export const api = {
  restaurant: () => request<RestaurantInfo>('/restaurant'),
  menu: () => request<{ categories: Category[] }>('/menu'),
  product: (slug: string) => request<{ product: Product }>(`/menu/products/${slug}`),

  register: (body: { name: string; phone: string; email?: string; password?: string }) =>
    request<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST',
      body,
    }),
  login: (body: { phone: string; password: string }) =>
    request<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body,
    }),
  refresh: (refreshToken: string) =>
    request<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipRefresh: true,
    }),
  logout: (refreshToken: string) =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request<{ user: SessionUser }>('/auth/me'),
  updateMe: (body: { name?: string; email?: string; marketingConsent?: boolean }) =>
    request<{ user: SessionUser }>('/auth/me', { method: 'PATCH', body }),

  createOrder: (body: Record<string, unknown>) =>
    request<{ order: OrderView }>('/orders', { method: 'POST', body }),
  trackOrder: (id: string) => request<{ order: OrderView }>(`/orders/${id}/track`),
  myOrders: () => request<{ orders: OrderView[]; nextCursor: string | null }>('/orders/mine'),
  cancelOrder: (id: string, reason?: string) =>
    request<{ order: OrderView }>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),

  initiatePayment: (orderId: string) =>
    request<{ payment: { id: string; status: string }; redirectUrl?: string; instructions?: string }>(
      `/payments/${orderId}/initiate`,
      { method: 'POST' },
    ),
  simulatePayment: (orderId: string) =>
    request<{ payment: { status: string } }>(`/payments/${orderId}/simulate`, { method: 'POST' }),

  resolveTable: (token: string, deviceId: string) =>
    request<{ table: { number: string; capacity: number }; session: { id: string; expiresAt: string } }>(
      '/tables/resolve',
      { method: 'POST', body: { token, deviceId } },
    ),

  addresses: () => request<{ addresses: Address[] }>('/addresses'),
  createAddress: (body: Record<string, unknown>) =>
    request<{ address: Address }>('/addresses', { method: 'POST', body }),
  deleteAddress: (id: string) => request<{ ok: boolean }>(`/addresses/${id}`, { method: 'DELETE' }),

  notifications: () =>
    request<{ notifications: NotificationView[]; unread: number }>('/notifications'),
  markNotificationsRead: () => request<{ ok: boolean }>('/notifications/read', { method: 'POST' }),

  loyalty: () => request<{ balance: number; transactions: LoyaltyTransaction[] }>('/loyalty'),
};

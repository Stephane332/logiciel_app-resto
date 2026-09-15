/** Points d'entrée utilisés par l'application cliente. */
import { request } from './http.js';
import type {
  Address,
  Category,
  CustomerOrder,
  LoyaltyTransaction,
  NotificationView,
  Product,
  RestaurantInfo,
  Session,
  SessionUser,
} from './types.js';

export const customerApi = {
  restaurant: () => request<RestaurantInfo>('/restaurant'),
  menu: () => request<{ categories: Category[] }>('/menu'),
  product: (slug: string) => request<{ product: Product }>(`/menu/products/${slug}`),

  register: (body: { name: string; phone: string; email?: string; password?: string }) =>
    request<Session>('/auth/register', { method: 'POST', body }),
  login: (body: { phone: string; password: string }) =>
    request<Session>('/auth/login', { method: 'POST', body }),
  refresh: (refreshToken: string) =>
    request<Session>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipRefresh: true }),
  logout: (refreshToken: string) =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request<{ user: SessionUser }>('/auth/me'),
  updateMe: (body: { name?: string; email?: string; marketingConsent?: boolean }) =>
    request<{ user: SessionUser }>('/auth/me', { method: 'PATCH', body }),

  createOrder: (body: Record<string, unknown>) =>
    request<{ order: CustomerOrder }>('/orders', { method: 'POST', body }),
  trackOrder: (id: string) => request<{ order: CustomerOrder }>(`/orders/${id}/track`),
  myOrders: () =>
    request<{ orders: CustomerOrder[]; nextCursor: string | null }>('/orders/mine'),
  cancelOrder: (id: string, reason?: string) =>
    request<{ order: CustomerOrder }>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),

  initiatePayment: (orderId: string) =>
    request<{
      payment: { id: string; status: string; amount: number };
      redirectUrl?: string;
      instructions?: string;
      ussdCode?: string;
      dialLink?: string;
      merchantNumber?: string;
      requiresDeclaration: boolean;
    }>(`/payments/${orderId}/initiate`, { method: 'POST' }),

  /**
   * Le client recopie l'identifiant reçu par SMS.
   * C'est une déclaration : seul le restaurant peut confirmer le paiement.
   */
  declarePayment: (orderId: string, reference: string) =>
    request<{ payment: { id: string; status: string }; message: string }>(
      `/payments/${orderId}/declare`,
      { method: 'POST', body: { reference } },
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

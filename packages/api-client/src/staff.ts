/** Points d'entrée utilisés par le logiciel restaurant. */
import type { OrderStatus, PaymentMethod, RejectionReason, Role } from '@barabite/shared';
import { request } from './http.js';
import type {
  Category,
  PaymentToVerify,
  SmsReadResult,
  DeliveryZone,
  Employee,
  OpeningHour,
  Order,
  Product,
  RangeStats,
  RestaurantInfo,
  RestaurantSettings,
  RestaurantTable,
  Session,
  SetupStatus,
  TodayStats,
} from './types.js';

export const staffApi = {
  login: (body: { phone: string; password: string }) =>
    request<Session>('/auth/login', { method: 'POST', body }),
  refresh: (refreshToken: string) =>
    request<Session>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipRefresh: true }),
  logout: (refreshToken: string) =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request<{ user: Session['user'] }>('/auth/me'),

  restaurant: () => request<RestaurantInfo>('/restaurant'),
  updateSettings: (body: Record<string, unknown>) =>
    request<{ restaurant: RestaurantSettings }>('/restaurant/settings', { method: 'PATCH', body }),
  updateBrand: (body: Record<string, unknown>) =>
    request<{ restaurant: RestaurantSettings }>('/restaurant/brand', { method: 'PATCH', body }),
  updateHours: (hours: OpeningHour[]) =>
    request<{ hours: OpeningHour[] }>('/restaurant/hours', { method: 'PUT', body: { hours } }),
  setup: () => request<SetupStatus>('/restaurant/setup'),
  completeSetupStep: (step: string) =>
    request<{ ok: boolean }>(`/restaurant/setup/${step}`, { method: 'POST' }),

  // --- Commandes ------------------------------------------------------------

  orders: (params: { scope?: 'active' | 'today' | 'all'; status?: string; type?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.scope) query.set('scope', params.scope);
    if (params.status) query.set('status', params.status);
    if (params.type) query.set('type', params.type);
    const suffix = query.toString();
    return request<{ orders: Order[] }>(`/orders${suffix ? `?${suffix}` : ''}`);
  },
  order: (id: string) => request<{ order: Order; actions: OrderStatus[] }>(`/orders/${id}`),
  orderByCode: (code: string) => request<{ order: Order }>(`/orders/by-code/${code}`),
  createOrder: (body: Record<string, unknown>) =>
    request<{ order: Order }>('/orders', { method: 'POST', body }),

  accept: (id: string) => request<{ order: Order }>(`/orders/${id}/accept`, { method: 'POST' }),
  prepare: (id: string) => request<{ order: Order }>(`/orders/${id}/prepare`, { method: 'POST' }),
  ready: (id: string) => request<{ order: Order }>(`/orders/${id}/ready`, { method: 'POST' }),
  serve: (id: string) => request<{ order: Order }>(`/orders/${id}/serve`, { method: 'POST' }),
  complete: (id: string) => request<{ order: Order }>(`/orders/${id}/complete`, { method: 'POST' }),
  handover: (id: string, code?: string) =>
    request<{ order: Order }>(`/orders/${id}/handover`, { method: 'POST', body: { code } }),
  reject: (id: string, body: { reason: RejectionReason; comment?: string }) =>
    request<{ order: Order }>(`/orders/${id}/reject`, { method: 'POST', body }),
  cancel: (id: string, reason: string) =>
    request<{ order: Order }>(`/orders/${id}/cancel-staff`, { method: 'POST', body: { reason } }),
  assign: (id: string, courierId: string) =>
    request<{ order: Order }>(`/orders/${id}/assign`, { method: 'POST', body: { courierId } }),
  depart: (id: string) => request<{ order: Order }>(`/orders/${id}/depart`, { method: 'POST' }),
  delivered: (id: string) => request<{ order: Order }>(`/orders/${id}/delivered`, { method: 'POST' }),
  myDeliveries: () => request<{ orders: Order[] }>('/delivery/mine'),

  // --- Paiements ------------------------------------------------------------

  collect: (orderId: string, method: PaymentMethod = 'CASH') =>
    request<{ payment: { status: string } }>(`/payments/${orderId}/collect`, {
      method: 'POST',
      body: { method },
    }),
  /** File des paiements déclarés, en attente d'attestation. */
  paymentsToVerify: () => request<{ payments: PaymentToVerify[] }>('/payments/to-verify'),

  /** Le restaurant atteste avoir vu — ou non — l'argent arriver. */
  attestPayment: (paymentId: string, received: boolean, note?: string) =>
    request<{ payment: { id: string; status: string } }>(`/payments/${paymentId}/attest`, {
      method: 'POST',
      body: { received, note },
    }),

  /** Lecture du SMS de l'opérateur collé par le restaurant. */
  readSms: (text: string) => request<SmsReadResult>('/payments/read-sms', { method: 'POST', body: { text } }),

  refund: (paymentId: string, body: { amount?: number; reason: string }) =>
    request<{ refund: { id: string; amount: number } }>(`/payments/${paymentId}/refund`, {
      method: 'POST',
      body,
    }),

  // --- Menu -----------------------------------------------------------------

  manageMenu: () => request<{ categories: Category[] }>('/menu/manage'),
  createCategory: (body: Record<string, unknown>) =>
    request<{ category: Category }>('/menu/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    request<{ category: Category }>(`/menu/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/menu/categories/${id}`, { method: 'DELETE' }),
  createProduct: (body: Record<string, unknown>) =>
    request<{ product: Product }>('/menu/products', { method: 'POST', body }),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    request<{ product: Product }>(`/menu/products/${id}`, { method: 'PATCH', body }),
  setAvailability: (id: string, body: { isAvailable?: boolean; stock?: number | null }) =>
    request<{ product: Product }>(`/menu/products/${id}/availability`, { method: 'PATCH', body }),
  deleteProduct: (id: string) =>
    request<{ product?: Product; ok?: boolean; archived: boolean }>(`/menu/products/${id}`, {
      method: 'DELETE',
    }),

  // --- Tables ---------------------------------------------------------------

  tables: () => request<{ tables: RestaurantTable[] }>('/tables'),
  createTable: (body: { number: string; capacity?: number }) =>
    request<{ table: RestaurantTable }>('/tables', { method: 'POST', body }),
  updateTable: (id: string, body: Record<string, unknown>) =>
    request<{ table: RestaurantTable }>(`/tables/${id}`, { method: 'PATCH', body }),
  regenerateQr: (id: string) =>
    request<{ qrUrl: string; message: string }>(`/tables/${id}/regenerate-qr`, { method: 'POST' }),
  deleteTable: (id: string) => request<{ ok?: boolean; archived?: boolean }>(`/tables/${id}`, { method: 'DELETE' }),

  // --- Zones de livraison ----------------------------------------------------

  zones: () => request<{ zones: DeliveryZone[] }>('/restaurant/delivery-zones'),
  createZone: (body: Record<string, unknown>) =>
    request<{ zone: DeliveryZone }>('/restaurant/delivery-zones', { method: 'POST', body }),
  updateZone: (id: string, body: Record<string, unknown>) =>
    request<{ zone: DeliveryZone }>(`/restaurant/delivery-zones/${id}`, { method: 'PATCH', body }),
  deleteZone: (id: string) =>
    request<{ ok?: boolean; archived?: boolean }>(`/restaurant/delivery-zones/${id}`, { method: 'DELETE' }),

  // --- Statistiques et employés ----------------------------------------------

  todayStats: () => request<TodayStats>('/stats/today'),
  rangeStats: (days: number) => request<RangeStats>(`/stats/range?days=${days}`),
  topProducts: (days = 30) =>
    request<{ products: { name: string; quantity: number; revenue: number }[] }>(
      `/stats/top-products?days=${days}`,
    ),

  employees: () => request<{ employees: Employee[] }>('/employees'),
  createEmployee: (body: { name: string; phone: string; role: Role; password: string }) =>
    request<{ employee: Employee }>('/employees', { method: 'POST', body }),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    request<{ employee: Employee }>(`/employees/${id}`, { method: 'PATCH', body }),
};

/** Types des réponses de l'API, partagés par les interfaces. */
import type {
  OrderChannel,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Role,
  TableStatus,
} from '@barabite/shared';

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
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isOrderable: boolean;
  isFeatured: boolean;
  /** Absent des réponses publiques : le stock exact ne regarde pas le client. */
  stock?: number | null;
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
  isActive: boolean;
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
  position: number;
}

export interface RestaurantSettings {
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
  manuallyClosed: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  cashOnDelivery: boolean;
  cashOnPickup: boolean;
  cashOnDineIn: boolean;
  onlinePayment: boolean;
  loyaltyEnabled: boolean;
  loyaltyAmountPerPoint: number;
  loyaltyPointValue: number;
  loyaltyMinimumPoints: number;
  loyaltyMaxRedemptionPct: number;
  orangeMoneyNumber: string | null;
  orangeMoneyUssd: string;
  orangeMoneyEnabled: boolean;
  moovMoneyNumber: string | null;
  moovMoneyUssd: string;
  moovMoneyEnabled: boolean;
  whatsappOrderNumber: string | null;
}

/** Paiement déclaré par le client, en attente d'attestation du restaurant. */
export interface PaymentToVerify {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: string;
  declaredReference: string | null;
  declaredAt: string | null;
  order: {
    id: string;
    dailyNumber: number;
    type: OrderType;
    status: OrderStatus;
    customerName: string | null;
    customerPhone: string | null;
    customer: { name: string; phone: string } | null;
  };
}

export type SmsReadResult =
  | { kind: 'UNREADABLE' }
  | { kind: 'NO_MATCH'; amount: number | null }
  | { kind: 'MATCHED'; byReference: boolean; payment: PaymentToVerify }
  | { kind: 'AMBIGUOUS'; amount: number; candidates: PaymentToVerify[] };

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
      orangeMoney: boolean;
      moovMoney: boolean;
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
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note: string | null;
  options: { id: string; name: string; priceDelta: number }[];
}

export interface OrderEventView {
  id: string;
  status: OrderStatus;
  actorRole: string | null;
  reason: string | null;
  createdAt: string;
}

/** Vue complète, telle que la voit le personnel. */
export interface Order {
  id: string;
  dailyNumber: number;
  status: OrderStatus;
  type: OrderType;
  channel: OrderChannel;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  loyaltyDiscount: number;
  total: number;
  note: string | null;
  pickupCode: string | null;
  scheduledFor: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customer: { id: string; name: string; phone: string; loyaltyPoints: number } | null;
  courier: { id: string; name: string; phone: string } | null;
  table: { id: string; number: string } | null;
  deliverySector: string | null;
  deliveryLandmark: string | null;
  deliveryDetails: string | null;
  deliveryZone: DeliveryZone | null;
  rejectionReason: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: OrderItemView[];
  events: OrderEventView[];
  payments: { id: string; amount: number; method: PaymentMethod; status: string }[];
}

/** Vue restreinte, telle que la voit le client. */
export interface CustomerOrder {
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
  role: Role;
  loyaltyPoints: number;
  marketingConsent: boolean;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
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

export interface RestaurantTable {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  isActive: boolean;
  currentOrder: { id: string; dailyNumber: number; status: OrderStatus; total: number } | null;
  qrUrl: string;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  role: Role;
  isActive: boolean;
  lastSeenAt: string | null;
}

export interface TodayStats {
  orderCount: number;
  fulfilledCount: number;
  revenue: number;
  averageBasket: number;
  preparing: number;
  readyForPickup: number;
  toDeliver: number;
  rejected: number;
  byChannel: Record<string, number>;
  byType: Record<string, number>;
}

/**
 * Statistiques sur une période.
 *
 * N'hérite volontairement pas de `TodayStats` : les compteurs d'instant (« en préparation », « à
 * récupérer ») n'ont pas de sens sur trente jours, et un type qui les promettait faisait afficher
 * « NaN » à l'écran.
 */
export interface RangeStats {
  days: number;
  orderCount: number;
  fulfilledCount: number;
  revenue: number;
  averageBasket: number;
  rejected: number;
  cancelled: number;
  daily: { date: string; orders: number; revenue: number }[];
  hourly: { hour: number; orders: number }[];
  byChannel: Record<string, number>;
  byType: Record<string, number>;
}

export interface SetupStatus {
  steps: { key: string; label: string; done: boolean }[];
  completed: number;
  total: number;
  counts: { categories: number; products: number; tables: number; zones: number };
}

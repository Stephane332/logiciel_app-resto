export { ApiError, request } from '@barabite/api-client';
export type { Address, Category, DeliveryZone, LoyaltyTransaction, NotificationView, OpeningHour, OptionGroup, OptionItem, Product, RestaurantInfo, SessionUser, OrderItemView, } from '@barabite/api-client';
/** L'application cliente ne voit que la vue restreinte des commandes. */
export type { CustomerOrder as OrderView } from '@barabite/api-client';
export declare function configureApi(options: {
    readToken: () => string | null;
    refreshSession: () => Promise<string | null>;
}): void;
export declare const api: {
    restaurant: () => Promise<import("@barabite/api-client").RestaurantInfo>;
    menu: () => Promise<{
        categories: import("@barabite/api-client").Category[];
    }>;
    product: (slug: string) => Promise<{
        product: import("@barabite/api-client").Product;
    }>;
    register: (body: {
        name: string;
        phone: string;
        email?: string;
        password?: string;
    }) => Promise<import("@barabite/api-client").Session>;
    login: (body: {
        phone: string;
        password: string;
    }) => Promise<import("@barabite/api-client").Session>;
    refresh: (refreshToken: string) => Promise<import("@barabite/api-client").Session>;
    logout: (refreshToken: string) => Promise<{
        ok: boolean;
    }>;
    me: () => Promise<{
        user: import("@barabite/api-client").SessionUser;
    }>;
    updateMe: (body: {
        name?: string;
        email?: string;
        marketingConsent?: boolean;
    }) => Promise<{
        user: import("@barabite/api-client").SessionUser;
    }>;
    createOrder: (body: Record<string, unknown>) => Promise<{
        order: import("@barabite/api-client").CustomerOrder;
    }>;
    trackOrder: (id: string) => Promise<{
        order: import("@barabite/api-client").CustomerOrder;
    }>;
    myOrders: () => Promise<{
        orders: import("@barabite/api-client").CustomerOrder[];
        nextCursor: string | null;
    }>;
    cancelOrder: (id: string, reason?: string) => Promise<{
        order: import("@barabite/api-client").CustomerOrder;
    }>;
    initiatePayment: (orderId: string) => Promise<{
        payment: {
            id: string;
            status: string;
        };
        redirectUrl?: string;
        instructions?: string;
    }>;
    simulatePayment: (orderId: string) => Promise<{
        payment: {
            status: string;
        };
    }>;
    resolveTable: (token: string, deviceId: string) => Promise<{
        table: {
            number: string;
            capacity: number;
        };
        session: {
            id: string;
            expiresAt: string;
        };
    }>;
    addresses: () => Promise<{
        addresses: import("@barabite/api-client").Address[];
    }>;
    createAddress: (body: Record<string, unknown>) => Promise<{
        address: import("@barabite/api-client").Address;
    }>;
    deleteAddress: (id: string) => Promise<{
        ok: boolean;
    }>;
    notifications: () => Promise<{
        notifications: import("@barabite/api-client").NotificationView[];
        unread: number;
    }>;
    markNotificationsRead: () => Promise<{
        ok: boolean;
    }>;
    loyalty: () => Promise<{
        balance: number;
        transactions: import("@barabite/api-client").LoyaltyTransaction[];
    }>;
};
//# sourceMappingURL=api.d.ts.map
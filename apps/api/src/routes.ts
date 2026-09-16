import type { FastifyInstance } from 'fastify';
import { authRoutes } from './modules/auth/routes.js';
import { menuRoutes } from './modules/menu/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { paymentRoutes } from './modules/payments/routes.js';
import { tableRoutes } from './modules/tables/routes.js';
import { restaurantRoutes } from './modules/restaurant/routes.js';
import { statsRoutes } from './modules/stats/routes.js';
import { employeeRoutes } from './modules/employees/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { commissionRoutes } from './modules/commission/routes.js';
import { uploadRoutes } from './modules/uploads/routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(restaurantRoutes);
      await api.register(menuRoutes);
      await api.register(orderRoutes);
      await api.register(paymentRoutes);
      await api.register(tableRoutes);
      await api.register(statsRoutes);
      await api.register(employeeRoutes);
      await api.register(notificationRoutes);
      await api.register(commissionRoutes);
      await api.register(uploadRoutes);
    },
    { prefix: '/api/v1' },
  );
}

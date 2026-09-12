/**
 * Utilitaires des tests d'intégration.
 *
 * Chaque fichier de test repart d'une base propre : un test qui dépend de ce qu'un autre a laissé
 * derrière lui finit par mentir, dans un sens comme dans l'autre.
 */
import argon2 from 'argon2';
import { generateTableToken } from '@barabite/shared';
import { prisma } from './db.js';
import { resetRestaurantCache } from './lib/context.js';

export const TEST_PASSWORD = 'test-password-2026';

export async function resetDatabase(): Promise<void> {
  // Ordre imposé par les clés étrangères.
  await prisma.$transaction([
    prisma.orderItemOption.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.orderEvent.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.loyaltyTransaction.deleteMany(),
    prisma.order.deleteMany(),
    prisma.orderCounter.deleteMany(),
    prisma.tableSession.deleteMany(),
    prisma.restaurantTable.deleteMany(),
    prisma.optionItem.deleteMany(),
    prisma.optionGroup.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.address.deleteMany(),
    prisma.deliveryZone.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.openingHour.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.restaurant.deleteMany(),
  ]);
  resetRestaurantCache();
}

export interface Fixture {
  restaurantId: string;
  productId: string;
  friesId: string;
  sauceOptionId: string;
  extraCheeseId: string;
  tableToken: string;
  zoneId: string;
  users: Record<'admin' | 'manager' | 'cashier' | 'kitchen' | 'courier' | 'client', string>;
}

export async function seedFixture(): Promise<Fixture> {
  const restaurant = await prisma.restaurant.create({
    data: {
      slug: 'test-resto',
      name: 'Innova Group',
      tagline: 'Bon goût. Sans attente.',
      city: 'Ouahigouya',
      // Ouvert en permanence : les tests d'horaires fixent leurs propres plages.
      openingHours: {
        create: Array.from({ length: 7 }, (_, weekday) => ({ weekday, opensAt: 0, closesAt: 1439 })),
      },
    },
  });

  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  const roles = [
    ['admin', 'ADMIN', '+22670000001'],
    ['manager', 'MANAGER', '+22670000002'],
    ['cashier', 'CASHIER', '+22670000003'],
    ['kitchen', 'KITCHEN', '+22670000004'],
    ['courier', 'DELIVERY', '+22670000005'],
    ['client', 'CLIENT', '+22670123456'],
  ] as const;

  const users = {} as Fixture['users'];
  for (const [key, role, phone] of roles) {
    const user = await prisma.user.create({
      data: { restaurantId: restaurant.id, phone, name: key, role, passwordHash },
    });
    users[key] = user.id;
  }

  const category = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: 'Burgers', slug: 'burgers' },
  });

  const product = await prisma.product.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Double Cheese',
      slug: 'double-cheese',
      price: 3500,
    },
  });

  const sauces = await prisma.optionGroup.create({
    data: { productId: product.id, name: 'Sauce', minChoices: 1, maxChoices: 1 },
  });
  const sauce = await prisma.optionItem.create({
    data: { groupId: sauces.id, name: 'Sauce maison', priceDelta: 0 },
  });

  const extras = await prisma.optionGroup.create({
    data: { productId: product.id, name: 'Suppléments', minChoices: 0, maxChoices: 3 },
  });
  const extraCheese = await prisma.optionItem.create({
    data: { groupId: extras.id, name: 'Fromage supplémentaire', priceDelta: 500 },
  });

  const fries = await prisma.product.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Frites',
      slug: 'frites',
      price: 1500,
    },
  });

  const table = await prisma.restaurantTable.create({
    data: { restaurantId: restaurant.id, number: '08', qrToken: generateTableToken() },
  });

  const zone = await prisma.deliveryZone.create({
    data: { restaurantId: restaurant.id, name: 'Secteur 1', fee: 1000, minimumOrder: 2000 },
  });

  return {
    restaurantId: restaurant.id,
    productId: product.id,
    friesId: fries.id,
    sauceOptionId: sauce.id,
    extraCheeseId: extraCheese.id,
    tableToken: table.qrToken,
    zoneId: zone.id,
    users,
  };
}

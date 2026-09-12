/**
 * Tests d'intégration de l'API.
 *
 * Ils traduisent en code exécutable les critères d'acceptation du cahier des charges (§ 21) :
 * chaque critère devient une garantie vérifiée à chaque exécution, plutôt qu'une intention.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { prisma } from './db.js';
import { resetDatabase, seedFixture, TEST_PASSWORD, type Fixture } from './test-helpers.js';

let app: FastifyInstance;
let fixture: Fixture;

const api = (path: string) => `/api/v1${path}`;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  fixture = await seedFixture();
});

async function login(phone: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: api('/auth/login'),
    payload: { phone, password: TEST_PASSWORD },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json().accessToken as string;
}

const asCashier = () => login('+22670000003');
const asKitchen = () => login('+22670000004');
const asClient = () => login('+22670123456');
const asManager = () => login('+22670000002');
const asCourier = () => login('+22670000005');

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createPickupOrder(token?: string, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: 'POST',
    url: api('/orders'),
    ...(token ? { headers: auth(token) } : {}),
    payload: {
      type: 'PICKUP',
      channel: 'APP',
      paymentMethod: 'CASH',
      customerName: 'Aminata Ouédraogo',
      customerPhone: '+22670111222',
      lines: [{ productId: fixture.productId, quantity: 1, optionItemIds: [fixture.sauceOptionId] }],
      ...overrides,
    },
  });
}

// ---------------------------------------------------------------------------

describe('menu public', () => {
  it('se consulte sans compte — c\'est ce qui rend un lien partageable utile', async () => {
    const response = await app.inject({ method: 'GET', url: api('/menu') });
    expect(response.statusCode).toBe(200);
    expect(response.json().categories[0].products[0].name).toBe('Double Cheese');
  });

  it('ne divulgue pas le stock exact au client', async () => {
    await prisma.product.update({ where: { id: fixture.productId }, data: { stock: 3 } });
    const response = await app.inject({ method: 'GET', url: api('/menu') });
    const product = response.json().categories[0].products[0];
    expect(product.stock).toBeUndefined();
    expect(product.isOrderable).toBe(true);
  });
});

describe('création de commande', () => {
  it('calcule le total côté serveur, options comprises (critère A4)', async () => {
    const response = await createPickupOrder(undefined, {
      lines: [
        {
          productId: fixture.productId,
          quantity: 2,
          optionItemIds: [fixture.sauceOptionId, fixture.extraCheeseId],
        },
      ],
    });

    expect(response.statusCode, response.body).toBe(201);
    const { order } = response.json();
    // (3 500 + 0 + 500) × 2 = 8 000
    expect(order.subtotal).toBe(8000);
    expect(order.total).toBe(8000);
  });

  it('refuse un total annoncé différent du total réel (critère A10)', async () => {
    const response = await createPickupOrder(undefined, { expectedTotal: 1 });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('TOTAL_MISMATCH');
  });

  it('attribue un code de retrait lisible à voix haute (critère A6)', async () => {
    const response = await createPickupOrder();
    const { order } = response.json();
    expect(order.pickupCode).toMatch(/^[ACDEFGHJKMNPQRTUVWXYZ2346789]{5}$/);
  });

  it('numérote les commandes sans collision, même simultanées', async () => {
    const responses = await Promise.all([
      createPickupOrder(),
      createPickupOrder(),
      createPickupOrder(),
      createPickupOrder(),
      createPickupOrder(),
    ]);
    const numbers = responses.map((response) => response.json().order.dailyNumber);
    expect(new Set(numbers).size).toBe(5);
  });

  it('refuse un produit indisponible en le nommant (critère A7)', async () => {
    await prisma.product.update({ where: { id: fixture.productId }, data: { isAvailable: false } });
    const response = await createPickupOrder();
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('ITEMS_UNAVAILABLE');
    expect(response.json().error.message).toContain('Double Cheese');
  });

  it('refuse un produit en rupture de stock', async () => {
    await prisma.product.update({ where: { id: fixture.productId }, data: { stock: 0 } });
    const response = await createPickupOrder();
    expect(response.statusCode).toBe(422);
  });

  it('décrémente le stock et bascule le produit en indisponible à zéro', async () => {
    await prisma.product.update({ where: { id: fixture.productId }, data: { stock: 1 } });
    const response = await createPickupOrder();
    expect(response.statusCode).toBe(201);

    const product = await prisma.product.findUnique({ where: { id: fixture.productId } });
    expect(product?.stock).toBe(0);
    expect(product?.isAvailable).toBe(false);
  });

  it('exige les options obligatoires définies par le restaurant', async () => {
    const response = await createPickupOrder(undefined, {
      lines: [{ productId: fixture.productId, quantity: 1, optionItemIds: [] }],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('OPTION_REQUIRED');
  });

  it('refuse une option qui n\'appartient pas au produit', async () => {
    const response = await createPickupOrder(undefined, {
      lines: [{ productId: fixture.friesId, quantity: 1, optionItemIds: [fixture.extraCheeseId] }],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_OPTION');
  });

  it('crée discrètement un compte autour du numéro, pour retrouver l\'historique plus tard', async () => {
    await createPickupOrder();
    const user = await prisma.user.findUnique({
      where: { restaurantId_phone: { restaurantId: fixture.restaurantId, phone: '+22670111222' } },
    });
    expect(user?.name).toBe('Aminata Ouédraogo');
    expect(user?.passwordHash).toBeNull();
  });

  it('refuse la prise de commande hors horaires (critère A12)', async () => {
    await prisma.restaurant.update({
      where: { id: fixture.restaurantId },
      data: { manuallyClosed: true },
    });
    const response = await createPickupOrder();
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('RESTAURANT_CLOSED');
  });
});

describe('commande sur place par QR Code', () => {
  it('conserve le numéro de table de bout en bout (critère A5)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DINE_IN',
        channel: 'QR_TABLE',
        paymentMethod: 'CASH',
        tableToken: fixture.tableToken,
        lines: [{ productId: fixture.friesId, quantity: 1 }],
      },
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().order.table.number).toBe('08');
  });

  it('refuse un jeton de table inconnu (critère A11)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DINE_IN',
        channel: 'QR_TABLE',
        paymentMethod: 'CASH',
        tableToken: 'jeton-totalement-invente',
        lines: [{ productId: fixture.friesId, quantity: 1 }],
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('INVALID_TABLE');
  });

  it('rend l\'ancien QR Code inutilisable après régénération', async () => {
    const token = await login('+22670000003');
    const table = await prisma.restaurantTable.findFirst({ where: { qrToken: fixture.tableToken } });

    await app.inject({
      method: 'POST',
      url: api(`/tables/${table!.id}/regenerate-qr`),
      headers: auth(token),
    });

    const response = await app.inject({
      method: 'POST',
      url: api('/tables/resolve'),
      payload: { token: fixture.tableToken, deviceId: 'appareil-test' },
    });
    expect(response.statusCode).toBe(422);
  });
});

describe('livraison', () => {
  it('applique le forfait de la zone et l\'ajoute au total', async () => {
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DELIVERY',
        channel: 'APP',
        paymentMethod: 'CASH',
        customerName: 'Ibrahim Diallo',
        customerPhone: '+22670333444',
        address: { sector: 'Secteur 1', landmark: 'Face à la pharmacie' },
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });

    expect(response.statusCode, response.body).toBe(201);
    const { order } = response.json();
    expect(order.subtotal).toBe(3000);
    expect(order.deliveryFee).toBe(1000);
    expect(order.total).toBe(4000);
  });

  it('refuse une zone non desservie plutôt que de livrer à l\'aveugle', async () => {
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DELIVERY',
        channel: 'APP',
        paymentMethod: 'CASH',
        customerPhone: '+22670333444',
        address: { sector: 'Secteur 99', landmark: 'Très loin' },
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('OUT_OF_DELIVERY_AREA');
  });

  it('fait respecter le minimum de commande de la zone', async () => {
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DELIVERY',
        channel: 'APP',
        paymentMethod: 'CASH',
        customerPhone: '+22670333444',
        address: { sector: 'Secteur 1', landmark: 'Face à la pharmacie' },
        lines: [{ productId: fixture.friesId, quantity: 1 }],
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('BELOW_MINIMUM');
  });
});

describe('canal caisse (ADR 005)', () => {
  it('démarre directement en préparation : l\'employé qui tape est le restaurant', async () => {
    const token = await asCashier();
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      headers: auth(token),
      payload: {
        type: 'PICKUP',
        channel: 'COUNTER',
        paymentMethod: 'CASH',
        customerName: 'Client comptoir',
        lines: [{ productId: fixture.friesId, quantity: 1 }],
      },
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().order.status).toBe('PREPARING');
  });

  it('interdit à un client de se faire passer pour le comptoir', async () => {
    const token = await asClient();
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      headers: auth(token),
      payload: {
        type: 'PICKUP',
        channel: 'COUNTER',
        paymentMethod: 'CASH',
        lines: [{ productId: fixture.friesId, quantity: 1 }],
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('compte la commande de comptoir dans le chiffre d\'affaires du jour (critère A15)', async () => {
    const cashier = await asCashier();
    const created = await app.inject({
      method: 'POST',
      url: api('/orders'),
      headers: auth(cashier),
      payload: {
        type: 'PICKUP',
        channel: 'COUNTER',
        paymentMethod: 'CASH',
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });
    const orderId = created.json().order.id;

    await app.inject({ method: 'POST', url: api(`/orders/${orderId}/ready`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${orderId}/handover`), headers: auth(cashier) });

    const stats = await app.inject({ method: 'GET', url: api('/stats/today'), headers: auth(cashier) });
    expect(stats.json().revenue).toBe(3000);
    expect(stats.json().byChannel.COUNTER).toBe(1);
  });
});

describe('cycle de vie et permissions', () => {
  it('déroule le parcours complet d\'un retrait (critères A2, A6)', async () => {
    const cashier = await asCashier();
    const kitchen = await asKitchen();

    const created = await createPickupOrder();
    const { id, pickupCode } = created.json().order;

    expect((await app.inject({ method: 'POST', url: api(`/orders/${id}/accept`), headers: auth(cashier) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: api(`/orders/${id}/prepare`), headers: auth(kitchen) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: api(`/orders/${id}/ready`), headers: auth(kitchen) })).statusCode).toBe(200);

    const handover = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/handover`),
      headers: auth(cashier),
      payload: { code: pickupCode },
    });
    expect(handover.statusCode).toBe(200);
    expect(handover.json().order.status).toBe('PICKED_UP');
  });

  it('refuse la remise si le code de retrait ne correspond pas', async () => {
    const cashier = await asCashier();
    const created = await createPickupOrder();
    const { id } = created.json().order;

    await app.inject({ method: 'POST', url: api(`/orders/${id}/accept`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/prepare`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/ready`), headers: auth(cashier) });

    const handover = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/handover`),
      headers: auth(cashier),
      payload: { code: 'XXXXX' },
    });
    expect(handover.statusCode).toBe(403);
  });

  it('rejette une transition qui saute une étape (critère A8)', async () => {
    const cashier = await asCashier();
    const created = await createPickupOrder();
    const { id } = created.json().order;

    const response = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/ready`),
      headers: auth(cashier),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('UNKNOWN_TRANSITION');
  });

  it('interdit à la cuisine d\'accepter une commande', async () => {
    const kitchen = await asKitchen();
    const created = await createPickupOrder();
    const { id } = created.json().order;

    const response = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/accept`),
      headers: auth(kitchen),
    });
    expect(response.statusCode).toBe(403);
  });

  it('interdit à la cuisine de modifier un prix (critère A9)', async () => {
    const kitchen = await asKitchen();
    const response = await app.inject({
      method: 'PATCH',
      url: api(`/menu/products/${fixture.productId}`),
      headers: auth(kitchen),
      payload: { price: 1 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('autorise la cuisine à signaler une rupture — elle seule sait ce qui manque', async () => {
    const kitchen = await asKitchen();
    const response = await app.inject({
      method: 'PATCH',
      url: api(`/menu/products/${fixture.productId}/availability`),
      headers: auth(kitchen),
      payload: { isAvailable: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().product.isAvailable).toBe(false);
  });

  it('exige un motif écrit pour refuser une commande', async () => {
    const cashier = await asCashier();
    const created = await createPickupOrder();
    const { id } = created.json().order;

    const withoutReason = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/reject`),
      headers: auth(cashier),
      payload: {},
    });
    expect(withoutReason.statusCode).toBe(400);

    const withReason = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/reject`),
      headers: auth(cashier),
      payload: { reason: 'OUT_OF_STOCK', comment: 'Plus de pain' },
    });
    expect(withReason.statusCode).toBe(200);
    expect(withReason.json().order.status).toBe('REJECTED');
  });

  it('restitue le stock quand une commande est refusée', async () => {
    await prisma.product.update({ where: { id: fixture.productId }, data: { stock: 5 } });
    const cashier = await asCashier();
    const created = await createPickupOrder();
    const { id } = created.json().order;

    expect((await prisma.product.findUnique({ where: { id: fixture.productId } }))?.stock).toBe(4);

    await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/reject`),
      headers: auth(cashier),
      payload: { reason: 'TOO_BUSY' },
    });

    expect((await prisma.product.findUnique({ where: { id: fixture.productId } }))?.stock).toBe(5);
  });

  it('mène une livraison du restaurant jusqu\'à la remise', async () => {
    const cashier = await asCashier();
    const courier = await asCourier();

    const created = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DELIVERY',
        channel: 'APP',
        paymentMethod: 'CASH',
        customerPhone: '+22670333444',
        address: { sector: 'Secteur 1', landmark: 'Face à la pharmacie' },
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });
    const { id } = created.json().order;

    await app.inject({ method: 'POST', url: api(`/orders/${id}/accept`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/prepare`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/ready`), headers: auth(cashier) });

    const assigned = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/assign`),
      headers: auth(cashier),
      payload: { courierId: fixture.users.courier },
    });
    expect(assigned.json().order.status).toBe('ASSIGNED');

    await app.inject({ method: 'POST', url: api(`/orders/${id}/depart`), headers: auth(courier) });
    const delivered = await app.inject({
      method: 'POST',
      url: api(`/orders/${id}/delivered`),
      headers: auth(courier),
    });
    expect(delivered.json().order.status).toBe('DELIVERED');
  });
});

describe('fidélité (critère A16)', () => {
  it('crédite les points une fois la commande réellement servie, pas avant', async () => {
    const client = await asClient();
    const cashier = await asCashier();

    const created = await app.inject({
      method: 'POST',
      url: api('/orders'),
      headers: auth(client),
      payload: {
        type: 'PICKUP',
        channel: 'APP',
        paymentMethod: 'CASH',
        lines: [{ productId: fixture.friesId, quantity: 4 }],
      },
    });
    const { id } = created.json().order;

    expect((await prisma.user.findUnique({ where: { id: fixture.users.client } }))?.loyaltyPoints).toBe(0);

    await app.inject({ method: 'POST', url: api(`/orders/${id}/accept`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/prepare`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/ready`), headers: auth(cashier) });
    await app.inject({ method: 'POST', url: api(`/orders/${id}/handover`), headers: auth(cashier) });

    // 6 000 F à raison d'un point par tranche de 100 F.
    expect((await prisma.user.findUnique({ where: { id: fixture.users.client } }))?.loyaltyPoints).toBe(60);
  });
});

describe('suivi et historique', () => {
  it('laisse suivre une commande sans compte : connaître son identifiant suffit', async () => {
    const created = await createPickupOrder();
    const { id } = created.json().order;

    const response = await app.inject({ method: 'GET', url: api(`/orders/${id}/track`) });
    expect(response.statusCode).toBe(200);
    expect(response.json().order.number).toBeGreaterThan(0);
  });

  it('empêche un client de voir la file complète du restaurant', async () => {
    const client = await asClient();
    const response = await app.inject({ method: 'GET', url: api('/orders'), headers: auth(client) });
    expect(response.statusCode).toBe(403);
  });

  it('retrouve une commande par son code de retrait, malgré une saisie approximative', async () => {
    const cashier = await asCashier();
    const created = await createPickupOrder();
    const { pickupCode } = created.json().order;

    const response = await app.inject({
      method: 'GET',
      url: api(`/orders/by-code/${pickupCode.toLowerCase()}`),
      headers: auth(cashier),
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('gestion du catalogue par le restaurant (critère A17)', () => {
  it('permet de créer une catégorie, un produit et ses options sans intervention technique', async () => {
    const manager = await asManager();

    const category = await app.inject({
      method: 'POST',
      url: api('/menu/categories'),
      headers: auth(manager),
      payload: { name: 'Desserts' },
    });
    expect(category.statusCode).toBe(201);

    const product = await app.inject({
      method: 'POST',
      url: api('/menu/products'),
      headers: auth(manager),
      payload: {
        categoryId: category.json().category.id,
        name: 'Beignets maison',
        price: 500,
        description: 'Trois beignets, servis chauds.',
        optionGroups: [
          {
            name: 'Sucre',
            minChoices: 0,
            maxChoices: 1,
            items: [{ name: 'Sucre glace', priceDelta: 0 }],
          },
        ],
      },
    });

    expect(product.statusCode, product.body).toBe(201);
    expect(product.json().product.slug).toBe('beignets-maison');
    expect(product.json().product.optionGroups[0].items[0].name).toBe('Sucre glace');
  });

  it('archive un produit déjà commandé au lieu de l\'effacer avec son histoire', async () => {
    const manager = await asManager();
    await createPickupOrder();

    const response = await app.inject({
      method: 'DELETE',
      url: api(`/menu/products/${fixture.productId}`),
      headers: auth(manager),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().archived).toBe(true);
    expect(await prisma.product.count({ where: { id: fixture.productId } })).toBe(1);
  });

  it('journalise tout changement de prix', async () => {
    const manager = await asManager();
    await app.inject({
      method: 'PATCH',
      url: api(`/menu/products/${fixture.productId}`),
      headers: auth(manager),
      payload: { price: 4000 },
    });

    const log = await prisma.auditLog.findFirst({ where: { action: 'product.price_change' } });
    expect(log).not.toBeNull();
    expect((log?.data as { from: number; to: number }).from).toBe(3500);
  });
});

describe('prix figés à la commande', () => {
  it('conserve le prix payé même si le menu change ensuite', async () => {
    const manager = await asManager();
    const created = await createPickupOrder();
    const { id } = created.json().order;

    await app.inject({
      method: 'PATCH',
      url: api(`/menu/products/${fixture.productId}`),
      headers: auth(manager),
      payload: { price: 9999 },
    });

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    expect(order?.items[0]?.unitPrice).toBe(3500);
    expect(order?.total).toBe(3500);
  });
});

describe('authentification', () => {
  it('donne la même réponse pour un numéro inconnu et un mot de passe faux', async () => {
    const unknown = await app.inject({
      method: 'POST',
      url: api('/auth/login'),
      payload: { phone: '+22679999999', password: 'peu-importe' },
    });
    const wrongPassword = await app.inject({
      method: 'POST',
      url: api('/auth/login'),
      payload: { phone: '+22670123456', password: 'mauvais-mot-de-passe' },
    });

    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.json().error.message).toBe(wrongPassword.json().error.message);
  });

  it('normalise le numéro : une seule écriture, un seul compte', async () => {
    const response = await app.inject({
      method: 'POST',
      url: api('/auth/login'),
      payload: { phone: '70 12 34 56', password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(200);
  });

  it('refuse l\'accès sans jeton', async () => {
    const response = await app.inject({ method: 'GET', url: api('/auth/me') });
    expect(response.statusCode).toBe(401);
  });
});

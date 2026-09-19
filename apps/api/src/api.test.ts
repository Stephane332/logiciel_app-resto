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
    // On vérifie d'abord que les cinq ont abouti : sans cela, un échec de concurrence se
    // présenterait comme un « undefined » illisible plutôt que comme le défaut qu'il est.
    for (const response of responses) {
      expect(response.statusCode, response.body).toBe(201);
    }
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

  it('conserve la position donnée par le client et la transmet au livreur', async () => {
    /*
     * Le schéma acceptait `latitude`, `longitude` et `accuracy` depuis le début — et le service les
     * jetait. Rien ne le signalait : la commande partait en 201, la validation semblait faire son
     * travail, et la position n'existait nulle part. Une validation qui ne mène à rien est pire que
     * pas de validation, parce qu'elle fait croire que la fonction est là.
     */
    const creation = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DELIVERY',
        channel: 'APP',
        paymentMethod: 'CASH',
        customerName: 'Awa Traoré',
        customerPhone: '+22670333555',
        address: {
          sector: 'Secteur 1',
          landmark: 'Face au château d\'eau',
          latitude: 13.5828,
          longitude: -2.4219,
          accuracy: 18,
        },
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });

    expect(creation.statusCode, creation.body).toBe(201);
    const { order } = creation.json();
    expect(order.deliveryLatitude).toBeCloseTo(13.5828, 4);
    expect(order.deliveryLongitude).toBeCloseTo(-2.4219, 4);
    expect(order.deliveryAccuracy).toBe(18);
    // Le repère reste exigé : la position aide à s'approcher, elle ne dit pas où frapper.
    expect(order.deliveryLandmark).toBe('Face au château d\'eau');
  });

  it('prévient le livreur sur son téléphone quand une course lui est confiée', async () => {
    /*
     * Le livreur ne recevait rien du tout. Il ne fait plus partie de la diffusion générale du
     * restaurant — elle contenait les commandes des autres clients — et personne ne lui parlait
     * directement : son écran apprenait l'affectation au rechargement suivant, jusqu'à quinze
     * secondes plus tard, sans alerte. Un livreur qui ne fixe pas son téléphone ne partait pas.
     */
    const creation = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'DELIVERY',
        channel: 'APP',
        paymentMethod: 'CASH',
        customerName: 'Moussa Kanté',
        customerPhone: '+22670333666',
        address: { sector: 'Secteur 1', landmark: 'Près du marché' },
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });
    expect(creation.statusCode, creation.body).toBe(201);
    const orderId = creation.json().order.id;

    const manager = await asManager();
    for (const etape of ['accept', 'prepare', 'ready']) {
      const passage = await app.inject({
        method: 'POST',
        url: api(`/orders/${orderId}/${etape}`),
        headers: auth(manager),
      });
      expect(passage.statusCode, `${etape} : ${passage.body}`).toBe(200);
    }

    const courier = await prisma.user.findFirst({
      where: { restaurantId: fixture.restaurantId, role: 'DELIVERY' },
    });
    expect(courier).not.toBeNull();

    const affectation = await app.inject({
      method: 'POST',
      url: api(`/orders/${orderId}/assign`),
      headers: auth(manager),
      payload: { courierId: courier!.id },
    });
    expect(affectation.statusCode, affectation.body).toBe(200);
    expect(affectation.json().order.status).toBe('ASSIGNED');

    const notifications = await prisma.notification.findMany({
      where: { userId: courier!.id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.body).toContain('course vous est confiée');
    // Le secteur figure dans le message : le livreur sait où il va avant d'ouvrir l'écran.
    expect(notifications[0]!.body).toContain('Secteur 1');
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

  it('interdit à un client d\'accéder à la vue de gestion du menu', async () => {
    // `menu:read` est aussi accordé aux clients, qui consultent la carte : la vue de gestion, qui
    // expose le stock réel et les produits désactivés, doit exiger davantage.
    const client = await asClient();
    const manage = await app.inject({ method: 'GET', url: api('/menu/manage'), headers: auth(client) });
    const zones = await app.inject({
      method: 'GET',
      url: api('/restaurant/delivery-zones'),
      headers: auth(client),
    });
    expect(manage.statusCode).toBe(403);
    expect(zones.statusCode).toBe(403);
  });

  it('laisse le personnel accéder à la vue de gestion', async () => {
    const kitchen = await asKitchen();
    const response = await app.inject({ method: 'GET', url: api('/menu/manage'), headers: auth(kitchen) });
    expect(response.statusCode).toBe(200);
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

describe('Mobile Money déclaré puis attesté (ADR 008)', () => {
  /**
   * La règle qui commande tout ce bloc :
   *
   *   Celui qui paie ne confirme jamais son propre paiement.
   *
   * Un client peut mentir dans le champ « identifiant ». Il ne peut pas faire
   * apparaître un SMS sur le téléphone du patron. Ces tests vérifient que le
   * code ne lui offre aucun raccourci.
   */
  async function enableOrangeMoney() {
    await prisma.restaurant.update({
      where: { id: fixture.restaurantId },
      data: { orangeMoneyEnabled: true, orangeMoneyNumber: '76055792' },
    });
  }

  async function createMobileMoneyOrder() {
    const response = await app.inject({
      method: 'POST',
      url: api('/orders'),
      payload: {
        type: 'PICKUP',
        channel: 'APP',
        paymentMethod: 'ORANGE_MONEY',
        customerName: 'Aminata Ouédraogo',
        customerPhone: '+22670111222',
        lines: [{ productId: fixture.friesId, quantity: 1 }],
      },
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().order;
  }

  it("remet au client le code USSD déjà rempli, sans jamais lui donner le modèle", async () => {
    await enableOrangeMoney();
    const order = await createMobileMoneyOrder();

    const response = await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    expect(response.statusCode, response.body).toBe(200);

    const body = response.json();
    // Le montant et le numéro du marchand sont déjà dans le code : le client n'a rien à saisir.
    expect(body.ussdCode).toBe('*144*10*76055792*1500#');
    expect(body.dialLink).toContain('%23');
    expect(body.requiresDeclaration).toBe(true);
  });

  it("refuse d'initier un moyen que le restaurant n'a pas activé", async () => {
    const order = await createMobileMoneyOrder();
    const response = await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('METHOD_UNAVAILABLE');
  });

  it('enregistre la déclaration du client SANS confirmer le paiement', async () => {
    await enableOrangeMoney();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });

    const response = await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: 'MP260902.0128.19397304' },
    });

    expect(response.statusCode, response.body).toBe(200);
    // DECLARED, surtout pas CONFIRMED : la parole du payeur n'encaisse rien.
    expect(response.json().payment.status).toBe('DECLARED');

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    expect(payment?.status).toBe('DECLARED');
    expect(payment?.confirmedAt).toBeNull();
  });

  it("n'offre au client aucune route pour attester lui-même", async () => {
    await enableOrangeMoney();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: 'MP260902.0128.19397304' },
    });

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    const client = await asClient();

    // Ni connecté comme client, ni anonyme : l'attestation est réservée au personnel.
    const asCustomer = await app.inject({
      method: 'POST',
      url: api(`/payments/${payment!.id}/attest`),
      headers: auth(client),
      payload: { received: true },
    });
    const anonymous = await app.inject({
      method: 'POST',
      url: api(`/payments/${payment!.id}/attest`),
      payload: { received: true },
    });

    expect(asCustomer.statusCode).toBe(403);
    expect(anonymous.statusCode).toBe(401);

    const after = await prisma.payment.findUnique({ where: { id: payment!.id } });
    expect(after?.status).toBe('DECLARED');
  });

  it("confirme le paiement quand le restaurant atteste l'avoir reçu", async () => {
    await enableOrangeMoney();
    const cashier = await asCashier();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: 'MP260902.0128.19397304' },
    });

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    const response = await app.inject({
      method: 'POST',
      url: api(`/payments/${payment!.id}/attest`),
      headers: auth(cashier),
      payload: { received: true, note: 'SMS reçu à 12h04' },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().payment.status).toBe('CONFIRMED');

    const after = await prisma.payment.findUnique({ where: { id: payment!.id } });
    expect(after?.attestedById).toBeTruthy();
    expect(after?.confirmedAt).not.toBeNull();
  });

  it("marque le paiement en échec quand le restaurant n'a rien vu", async () => {
    await enableOrangeMoney();
    const cashier = await asCashier();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: 'FAUX999999' },
    });

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    await app.inject({
      method: 'POST',
      url: api(`/payments/${payment!.id}/attest`),
      headers: auth(cashier),
      payload: { received: false },
    });

    const after = await prisma.payment.findUnique({ where: { id: payment!.id } });
    expect(after?.status).toBe('FAILED');
  });

  it('liste les paiements à vérifier pour le personnel uniquement', async () => {
    await enableOrangeMoney();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: 'MP260902.0128.19397304' },
    });

    const cashier = await asCashier();
    const client = await asClient();

    const staffView = await app.inject({ method: 'GET', url: api('/payments/to-verify'), headers: auth(cashier) });
    const clientView = await app.inject({ method: 'GET', url: api('/payments/to-verify'), headers: auth(client) });

    expect(staffView.statusCode).toBe(200);
    expect(staffView.json().payments).toHaveLength(1);
    expect(clientView.statusCode).toBe(403);
  });

  it("retrouve la commande à partir du SMS collé par le restaurant", async () => {
    await enableOrangeMoney();
    const cashier = await asCashier();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });
    await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: 'MP260902.0128.19397304' },
    });

    const response = await app.inject({
      method: 'POST',
      url: api('/payments/read-sms'),
      headers: auth(cashier),
      payload: {
        text:
          'Votre paiement de 1500.00 FCFA, Frais: 4.3478 FCFA a INNOVA GROUP a ete effectue ' +
          'avec succes. Trans id: MP260902.0128.19397304.',
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().kind).toBe('MATCHED');
    // Reconnue par l'identifiant : deux transactions ne portent jamais le même numéro.
    expect(response.json().byReference).toBe(true);
  });

  it("refuse la lecture du SMS à un client — c'est l'écran du patron", async () => {
    const client = await asClient();
    const response = await app.inject({
      method: 'POST',
      url: api('/payments/read-sms'),
      headers: auth(client),
      payload: { text: 'Votre paiement de 1500 FCFA. Trans id: ABC123456.' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuse un identifiant qui ne ressemble à rien', async () => {
    await enableOrangeMoney();
    const order = await createMobileMoneyOrder();
    await app.inject({ method: 'POST', url: api(`/payments/${order.id}/initiate`) });

    const response = await app.inject({
      method: 'POST',
      url: api(`/payments/${order.id}/declare`),
      payload: { reference: '<script>' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REFERENCE');
  });

  it("refuse d'activer un moyen sans numéro marchand", async () => {
    // Le clavier du client s'ouvrirait sur un code muet, et il croirait avoir payé.
    const admin = await login('+22670000001');
    const response = await app.inject({
      method: 'PATCH',
      url: api('/restaurant/settings'),
      headers: auth(admin),
      payload: { moovMoneyEnabled: true, moovMoneyNumber: '' },
    });
    expect(response.statusCode).toBe(400);
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

// ---------------------------------------------------------------------------

describe('commission de la plateforme (ADR 009)', () => {
  /** Mène une commande de retrait jusqu'à sa remise au client. */
  async function serveOrder(orderId: string, token: string) {
    for (const step of ['accept', 'prepare', 'ready', 'handover', 'complete']) {
      const response = await app.inject({
        method: 'POST',
        url: api(`/orders/${orderId}/${step}`),
        headers: auth(token),
        payload: {},
      });
      expect(response.statusCode, `${step} → ${response.body}`).toBe(200);
    }
  }

  it('inscrit 1 % de l\'assiette quand la vente est faite, et pas avant', async () => {
    const created = await createPickupOrder();
    const order = created.json().order;
    const cashier = await asCashier();

    const manager = await asManager();
    const avant = await app.inject({
      method: 'GET',
      url: api('/commission/summary'),
      headers: auth(manager),
    });
    const dueAvant = avant.json().dueThisPeriod as number;

    await serveOrder(order.id, cashier);

    const apres = await app.inject({
      method: 'GET',
      url: api('/commission/summary'),
      headers: auth(manager),
    });
    expect(apres.statusCode, apres.body).toBe(200);
    const body = apres.json();

    expect(body.rateBps).toBe(100);
    expect(body.dueThisPeriod - dueAvant).toBe(Math.round(order.subtotal / 100));
  });

  it('ne facture jamais deux fois la même vente, malgré DELIVERED puis COMPLETED', async () => {
    // La commande passe deux fois par un statut d'achèvement : c'est la contrainte d'unicité sur
    // orderId qui protège, pas la lecture préalable.
    const created = await createPickupOrder();
    const order = created.json().order;
    const cashier = await asCashier();
    await serveOrder(order.id, cashier);

    const manager = await asManager();
    const entries = await app.inject({
      method: 'GET',
      url: api('/commission/entries'),
      headers: auth(manager),
    });
    const mine = entries.json().entries.filter((e: { orderId: string }) => e.orderId === order.id);
    expect(mine).toHaveLength(1);
  });

  it('ne facture pas une vente au comptoir', async () => {
    // Taxer la saisie au comptoir ferait cesser la saisie, et le chiffre d'affaires deviendrait faux.
    const cashier = await asCashier();
    const created = await app.inject({
      method: 'POST',
      url: api('/orders'),
      headers: auth(cashier),
      payload: {
        type: 'PICKUP',
        channel: 'COUNTER',
        paymentMethod: 'CASH',
        customerName: 'Client comptoir',
        lines: [{ productId: fixture.friesId, quantity: 2 }],
      },
    });
    const order = created.json().order;

    for (const step of ['ready', 'handover', 'complete']) {
      await app.inject({
        method: 'POST',
        url: api(`/orders/${order.id}/${step}`),
        headers: auth(cashier),
        payload: {},
      });
    }

    const manager = await asManager();
    const entries = await app.inject({
      method: 'GET',
      url: api('/commission/entries'),
      headers: auth(manager),
    });
    const mine = entries.json().entries.filter((e: { orderId: string }) => e.orderId === order.id);
    expect(mine).toHaveLength(0);
  });

  it('expose le détail commande par commande : une commission non vérifiable ne vaut rien', async () => {
    const created = await createPickupOrder();
    const order = created.json().order;
    await serveOrder(order.id, await asCashier());

    const manager = await asManager();
    const response = await app.inject({
      method: 'GET',
      url: api('/commission/entries'),
      headers: auth(manager),
    });
    const entry = response.json().entries.find((e: { orderId: string }) => e.orderId === order.id);

    expect(entry).toBeDefined();
    // De quoi refaire le calcul à la main — ce que le restaurateur fera au moins une fois.
    expect(entry.base).toBe(order.subtotal);
    expect(entry.rateBps).toBe(100);
    expect(entry.amount).toBe(Math.round((entry.base * entry.rateBps) / 10_000));
    expect(entry.order.dailyNumber).toBe(order.dailyNumber);
  });

  it('refuse d\'arrêter la période en cours : on ne fige pas un total encore ouvert', async () => {
    const manager = await asManager();
    const summary = await app.inject({
      method: 'GET',
      url: api('/commission/summary'),
      headers: auth(manager),
    });

    const response = await app.inject({
      method: 'POST',
      url: api('/commission/settlements/close'),
      headers: auth(manager),
      payload: { periodKey: summary.json().periodKey },
    });
    expect(response.statusCode).toBe(400);
  });

  it('garde la commission hors de portée de la cuisine et de la caisse', async () => {
    for (const token of [await asKitchen(), await asCashier(), await asClient()]) {
      const response = await app.inject({
        method: 'GET',
        url: api('/commission/summary'),
        headers: auth(token),
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('n\'expose jamais la commission au client sur sa commande', async () => {
    // Le client paie le prix affiché. Ce que le restaurant doit à la plateforme ne le regarde pas.
    const created = await createPickupOrder();
    const order = created.json().order;
    await serveOrder(order.id, await asCashier());

    // La route de suivi, celle que l'application cliente interroge réellement.
    const response = await app.inject({ method: 'GET', url: api(`/orders/${order.id}/track`) });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.body).not.toMatch(/commission/i);
  });
});

// ---------------------------------------------------------------------------

describe('photos de produits', () => {
  /** Une vraie photo, assez grande pour que la compression ait quelque chose à faire. */
  async function photoJpeg(width = 2400, height = 1800): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
  }

  function multipart(buffer: Buffer, filename: string, contentType: string) {
    const boundary = '----savora-test-boundary';
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    return {
      payload: Buffer.concat([head, buffer, tail]),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    };
  }

  it('accepte une photo et la rend beaucoup plus légère', async () => {
    const original = await photoJpeg();
    const token = await asManager();
    const { payload, headers } = multipart(original, 'plat.jpg', 'image/jpeg');

    const response = await app.inject({
      method: 'POST',
      url: api('/uploads/image'),
      headers: { ...headers, ...auth(token) },
      payload,
    });

    expect(response.statusCode, response.body).toBe(200);
    const stored = response.json();

    // Ramenée à la largeur d'affichage : au-delà, l'œil ne gagne rien sur un téléphone.
    expect(stored.width).toBe(1200);
    expect(stored.url).toMatch(/^\/media\/.+\.webp$/);
    expect(stored.thumbUrl).toMatch(/-vignette\.webp$/);

    // Le point qui compte à Ouahigouya : ce qui est servi doit être une fraction de l'original.
    expect(stored.bytes).toBeLessThan(original.byteLength / 4);
    expect(stored.bytes).toBeLessThan(250_000);
  });

  it('sert la photo enregistrée', async () => {
    const token = await asManager();
    const { payload, headers } = multipart(await photoJpeg(800, 600), 'plat.jpg', 'image/jpeg');
    const upload = await app.inject({
      method: 'POST',
      url: api('/uploads/image'),
      headers: { ...headers, ...auth(token) },
      payload,
    });

    // L'adresse enregistrée est relative à l'API — les interfaces la résolvent avec `mediaUrl`,
    // qui lui préfixe la base. Un chemin absolu en base ne survivrait pas à un changement de
    // domaine.
    const response = await app.inject({ method: 'GET', url: api(upload.json().url) });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['content-type']).toContain('image/webp');
  });

  it('refuse un fichier qui n\'est pas une image, quelle que soit son extension', async () => {
    // Le type déclaré ne prouve rien : c'est le décodage qui tranche.
    const { payload, headers } = multipart(Buffer.from('#!/bin/sh\nrm -rf /\n'), 'plat.jpg', 'image/jpeg');
    const token = await asManager();

    const response = await app.inject({
      method: 'POST',
      url: api('/uploads/image'),
      headers: { ...headers, ...auth(token) },
      payload,
    });

    expect([400, 422]).toContain(response.statusCode);
  });

  it('n\'ouvre pas le disque à qui ne tient pas le menu', async () => {
    const original = await photoJpeg(400, 300);
    for (const token of [await asKitchen(), await asClient()]) {
      const { payload, headers } = multipart(original, 'plat.jpg', 'image/jpeg');
      const response = await app.inject({
        method: 'POST',
        url: api('/uploads/image'),
        headers: { ...headers, ...auth(token) },
        payload,
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('refuse un envoi sans authentification', async () => {
    const { payload, headers } = multipart(await photoJpeg(400, 300), 'plat.jpg', 'image/jpeg');
    const response = await app.inject({ method: 'POST', url: api('/uploads/image'), headers, payload });
    expect(response.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe('visuel provisoire d\'un plat sans photo', () => {
  async function createCategory(token: string) {
    const response = await app.inject({
      method: 'POST',
      url: api('/menu/categories'),
      headers: auth(token),
      payload: { name: `Catégorie ${Date.now()}`, position: 0 },
    });
    return response.json().category.id as string;
  }

  it('dessine un visuel quand le restaurant n\'a pas encore de photo, et le dit', async () => {
    const token = await asManager();
    const categoryId = await createCategory(token);

    const response = await app.inject({
      method: 'POST',
      url: api('/menu/products'),
      headers: auth(token),
      payload: { categoryId, name: 'Poulet braisé', price: 3000, position: 0 },
    });

    expect(response.statusCode, response.body).toBe(201);
    const product = response.json().product;

    expect(product.imageUrl).toMatch(/\.webp$/);
    // Le drapeau est ce qui empêche le logiciel de faire passer un dessin pour une photo.
    expect(product.imagePlaceholder).toBe(true);
  });

  it('ne dessine rien quand le restaurant fournit sa photo', async () => {
    const token = await asManager();
    const categoryId = await createCategory(token);

    const response = await app.inject({
      method: 'POST',
      url: api('/menu/products'),
      headers: auth(token),
      payload: {
        categoryId,
        name: 'Riz gras',
        price: 2000,
        position: 0,
        imageUrl: '/media/resto/vraie-photo.webp',
      },
    });

    const product = response.json().product;
    expect(product.imageUrl).toBe('/media/resto/vraie-photo.webp');
    expect(product.imagePlaceholder).toBe(false);
  });

  it('cesse d\'être provisoire dès que la vraie photo arrive', async () => {
    const token = await asManager();
    const categoryId = await createCategory(token);

    const created = await app.inject({
      method: 'POST',
      url: api('/menu/products'),
      headers: auth(token),
      payload: { categoryId, name: 'Attiéké poisson', price: 2500, position: 0 },
    });
    const id = created.json().product.id;
    expect(created.json().product.imagePlaceholder).toBe(true);

    const updated = await app.inject({
      method: 'PATCH',
      url: api(`/menu/products/${id}`),
      headers: auth(token),
      payload: { imageUrl: '/media/resto/attieke.webp' },
    });

    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json().product.imagePlaceholder).toBe(false);
  });

  it('redevient sans image si le restaurant retire sa photo, sans retomber sur un dessin', async () => {
    // Retirer une photo est un choix du restaurant. Lui réimposer un dessin serait le contredire.
    const token = await asManager();
    const categoryId = await createCategory(token);

    const created = await app.inject({
      method: 'POST',
      url: api('/menu/products'),
      headers: auth(token),
      payload: { categoryId, name: 'Salade avocat', price: 1800, position: 0, imageUrl: '/media/x/a.webp' },
    });
    const id = created.json().product.id;

    const updated = await app.inject({
      method: 'PATCH',
      url: api(`/menu/products/${id}`),
      headers: auth(token),
      payload: { imageUrl: '' },
    });

    expect(updated.json().product.imageUrl).toBeNull();
    expect(updated.json().product.imagePlaceholder).toBe(false);
  });
});

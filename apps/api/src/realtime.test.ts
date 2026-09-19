/**
 * Tests du temps réel.
 *
 * Ils couvrent les deux critères d'acceptation que les tests d'API seuls ne pouvaient pas vérifier :
 *   A1 — une commande validée apparaît dans le logiciel restaurant en moins de deux secondes ;
 *   A3 — le client reçoit chaque changement de statut.
 *
 * Et un troisième point, qui n'est pas un critère mais une exigence de confidentialité : le flux du
 * restaurant transporte les commandes de tous les clients, donc un client ne doit jamais y entrer.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io, type Socket } from 'socket.io-client';
import { buildApp } from './app.js';
import { prisma } from './db.js';
import { initRealtime } from './lib/realtime.js';
import { resetDatabase, seedFixture, TEST_PASSWORD, type Fixture } from './test-helpers.js';

let app: FastifyInstance;
let baseUrl: string;
let fixture: Fixture;
const sockets: Socket[] = [];

/** Délai maximal admis, repris du cahier des charges (§ 18). */
const REALTIME_BUDGET_MS = 2000;

beforeAll(async () => {
  app = await buildApp();
  // Port 0 : le système en attribue un libre, ce qui évite les collisions entre exécutions.
  await app.listen({ port: 0, host: '127.0.0.1' });
  initRealtime(app.server);

  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('adresse du serveur indisponible');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await resetDatabase();
  fixture = await seedFixture();
});

function connect(auth: Record<string, unknown>): Socket {
  const socket = io(baseUrl, { path: '/realtime', auth, transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  return socket;
}

function waitForConnection(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

/** Attend un événement, ou échoue avec un message explicite plutôt qu'un dépassement muet. */
function waitForEvent<T = unknown>(socket: Socket, event: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`événement « ${event} » non reçu en ${timeout} ms`)),
      timeout,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function loginAs(phone: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { phone, password: TEST_PASSWORD },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json().accessToken as string;
}

async function createOrder(): Promise<{ id: string; dailyNumber: number }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    payload: {
      type: 'PICKUP',
      channel: 'APP',
      paymentMethod: 'CASH',
      customerName: 'Aminata Ouédraogo',
      customerPhone: '+22670111222',
      lines: [{ productId: fixture.friesId, quantity: 1 }],
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().order;
}

describe('diffusion vers le restaurant (critère A1)', () => {
  it('annonce une nouvelle commande au personnel en moins de deux secondes', async () => {
    const token = await loginAs('+22670000003');
    const socket = connect({ token });
    await waitForConnection(socket);

    const received = waitForEvent<{ id: string; dailyNumber: number }>(socket, 'order:created');
    const started = Date.now();
    const order = await createOrder();

    const event = await received;
    const elapsed = Date.now() - started;

    expect(event.id).toBe(order.id);
    expect(elapsed).toBeLessThan(REALTIME_BUDGET_MS);
  });

  it('annonce aussi les changements de statut au personnel', async () => {
    const token = await loginAs('+22670000003');
    const socket = connect({ token });
    await waitForConnection(socket);

    const order = await createOrder();
    const received = waitForEvent<{ status: string }>(socket, 'order:updated');

    await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${order.id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect((await received).status).toBe('ACCEPTED');
  });
});

describe('suivi côté client (critère A3)', () => {
  it('prévient le client à chaque changement de statut', async () => {
    const staffToken = await loginAs('+22670000003');
    const order = await createOrder();

    // Le client suit sa commande sans compte : connaître son identifiant suffit.
    const socket = connect({ orderId: order.id });
    await waitForConnection(socket);

    const received = waitForEvent<{ orderId: string; status: string }>(socket, 'order:status');

    await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${order.id}/accept`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    const event = await received;
    expect(event.orderId).toBe(order.id);
    expect(event.status).toBe('ACCEPTED');
  });

  it('ne livre à un client que les événements de sa propre commande', async () => {
    const staffToken = await loginAs('+22670000003');
    const mine = await createOrder();
    const other = await createOrder();

    const socket = connect({ orderId: mine.id });
    await waitForConnection(socket);

    const events: { orderId: string }[] = [];
    socket.on('order:status', (payload: { orderId: string }) => events.push(payload));

    await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${other.id}/accept`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(events.every((event) => event.orderId === mine.id)).toBe(true);
  });
});

describe('cloisonnement du flux restaurant', () => {
  it("n'admet pas un client dans le flux du restaurant", async () => {
    // Ce flux transporte les commandes de tous les clients : y laisser entrer un client
    // reviendrait à lui montrer les commandes des autres.
    const clientToken = await loginAs('+22670123456');
    const socket = connect({ token: clientToken });
    await waitForConnection(socket);

    const events: unknown[] = [];
    socket.on('order:created', (payload: unknown) => events.push(payload));

    await createOrder();
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(events).toHaveLength(0);
  });

  it("n'admet pas le livreur dans le flux général du restaurant", async () => {
    /*
     * Le cloisonnement tenait sur un chemin et pas sur l'autre.
     *
     * Le droit de lire toutes les commandes avait été retiré au livreur côté REST — mais la
     * condition d'entrée dans ce salon était « tout ce qui n'est pas un client ». Son téléphone
     * recevait donc, en direct, chaque commande du restaurant, y compris celles qu'il ne livre pas.
     *
     * Un cloisonnement qui ne tient que sur un chemin sur deux ne tient pas. La condition est
     * désormais exactement le droit correspondant : `order:read:all`.
     */
    const courierToken = await loginAs('+22670000005');
    const socket = connect({ token: courierToken });
    await waitForConnection(socket);

    const events: unknown[] = [];
    socket.on('order:created', (payload: unknown) => events.push(payload));
    socket.on('order:updated', (payload: unknown) => events.push(payload));

    await createOrder();
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(events).toHaveLength(0);
  });

  it("n'admet pas non plus une connexion sans jeton", async () => {
    const socket = connect({});
    await waitForConnection(socket);

    const events: unknown[] = [];
    socket.on('order:created', (payload: unknown) => events.push(payload));

    await createOrder();
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(events).toHaveLength(0);
  });
});

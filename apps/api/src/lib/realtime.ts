/**
 * Diffusion temps réel.
 *
 * Salons : `restaurant:{id}` pour le personnel, `order:{id}` pour le client qui suit sa commande.
 * Le temps réel est un confort, jamais une dépendance : chaque écran critique sait aussi se
 * recharger seul si la connexion tombe (ADR 006).
 */
import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { corsOrigins } from '../env.js';
import { verifyAccessToken } from './auth.js';

let io: SocketServer | null = null;

export function initRealtime(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: corsOrigins, credentials: true },
    path: '/realtime',
  });

  io.on('connection', async (socket) => {
    const { token, orderId, restaurantId } = socket.handshake.auth as {
      token?: string;
      orderId?: string;
      restaurantId?: string;
    };

    // Un client anonyme peut suivre sa commande : il en connaît l'identifiant, c'est suffisant pour
    // recevoir des changements de statut, et cela n'expose aucune donnée d'un autre client.
    if (orderId) socket.join(`order:${orderId}`);

    if (token) {
      try {
        const payload = await verifyAccessToken(token);
        socket.join(`user:${payload.sub}`);
        // Seul le personnel rejoint le salon du restaurant : c'est là que transitent toutes les
        // commandes, donc des données de tous les clients.
        if (payload.role !== 'CLIENT') {
          socket.join(`restaurant:${payload.restaurantId}`);
        }
      } catch {
        // Jeton invalide : la connexion reste ouverte, sans privilège.
      }
    } else if (restaurantId) {
      // Sans jeton, aucun accès au flux du restaurant.
    }
  });

  return io;
}

export type RealtimeEvent =
  | 'order:created'
  | 'order:updated'
  | 'order:status'
  | 'payment:updated'
  | 'menu:updated'
  | 'table:updated';

export function emitToRestaurant(restaurantId: string, event: RealtimeEvent, payload: unknown): void {
  io?.to(`restaurant:${restaurantId}`).emit(event, payload);
}

export function emitToOrder(orderId: string, event: RealtimeEvent, payload: unknown): void {
  io?.to(`order:${orderId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: RealtimeEvent, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getIo(): SocketServer | null {
  return io;
}

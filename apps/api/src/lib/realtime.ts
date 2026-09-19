/**
 * Diffusion temps réel.
 *
 * Salons : `restaurant:{id}` pour le personnel, `order:{id}` pour le client qui suit sa commande.
 * Le temps réel est un confort, jamais une dépendance : chaque écran critique sait aussi se
 * recharger seul si la connexion tombe (ADR 006).
 */
import { can } from '@savora/shared';
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
        /*
         * Le salon du restaurant diffuse **toutes** les commandes, donc les données de tous les
         * clients. Y entrer demande donc exactement le droit de lire toutes les commandes — et rien
         * de moins.
         *
         * La condition était `role !== 'CLIENT'`, ce qui laissait entrer le livreur : son téléphone
         * recevait chaque commande du restaurant en temps réel, y compris celles qu'il ne livre pas.
         * La porte REST lui était fermée, cette fenêtre restait ouverte — et un cloisonnement qui ne
         * tient que sur un chemin sur deux ne tient pas.
         */
        if (can(payload.role, 'order:read:all')) {
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

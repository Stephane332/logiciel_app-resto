/**
 * Temps réel du restaurant.
 *
 * Une commande doit apparaître en cuisine en moins de deux secondes. Le WebSocket s'en charge ;
 * le rechargement périodique tient lieu de filet, car sur le réseau local d'un restaurant de
 * Ouahigouya, la connexion persistante tombera (ADR 006).
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSession } from './session';

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || window.location.origin;

export interface RealtimeState {
  connected: boolean;
}

export function useRestaurantRealtime(onEvent: (event: string, payload: unknown) => void): RealtimeState {
  const token = useSession((state) => state.accessToken);
  const [connected, setConnected] = useState(false);
  // Référence plutôt que dépendance : on ne veut pas reconnecter le socket à chaque rendu.
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(REALTIME_URL, {
      path: '/realtime',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10_000,
    });

    const events = ['order:created', 'order:updated', 'order:status', 'payment:updated', 'menu:updated', 'table:updated'];
    for (const event of events) {
      socket.on(event, (payload: unknown) => handler.current(event, payload));
    }

    socket.on('connect', () => {
      setConnected(true);
      // Une reconnexion signifie qu'on a pu manquer des commandes : on resynchronise.
      handler.current('reconnected', null);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { connected };
}

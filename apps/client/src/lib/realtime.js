/**
 * Suivi temps réel d'une commande.
 *
 * Le WebSocket est un confort, jamais une dépendance : l'écran de suivi se recharge aussi tout seul,
 * pour le cas — fréquent — où la connexion persistante ne tient pas (ADR 006).
 */
import { useEffect } from 'react';
import { io } from 'socket.io-client';
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? window.location.origin;
export function useOrderRealtime(orderId, onUpdate) {
    useEffect(() => {
        if (!orderId)
            return;
        let socket = null;
        try {
            socket = io(REALTIME_URL, {
                path: '/realtime',
                auth: { orderId },
                transports: ['websocket', 'polling'],
                reconnectionDelay: 1500,
                reconnectionDelayMax: 10_000,
            });
            socket.on('order:status', onUpdate);
            socket.on('payment:updated', onUpdate);
            // Une reconnexion signifie qu'on a pu manquer des événements : on resynchronise.
            socket.on('connect', onUpdate);
        }
        catch {
            // Le temps réel indisponible n'empêche rien : le rechargement périodique prend le relais.
        }
        return () => {
            socket?.disconnect();
        };
    }, [orderId, onUpdate]);
}
//# sourceMappingURL=realtime.js.map
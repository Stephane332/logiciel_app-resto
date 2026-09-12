/**
 * Notifications.
 *
 * En V1 : enregistrement en base + diffusion temps réel. L'envoi push (FCM) et le SMS se branchent
 * ici sans toucher au reste du code.
 */
import type { NotificationType } from '@prisma/client';
import { prisma } from '../db.js';
import { emitToUser } from './realtime.js';

export interface NotifyInput {
  restaurantId: string;
  userId?: string | null;
  type?: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function notify(input: NotifyInput): Promise<void> {
  if (!input.userId) return;
  try {
    const notification = await prisma.notification.create({
      data: {
        restaurantId: input.restaurantId,
        userId: input.userId,
        type: input.type ?? 'ORDER_STATUS',
        title: input.title,
        body: input.body,
        data: (input.data ?? null) as never,
      },
    });
    emitToUser(input.userId, 'order:status', notification);
  } catch {
    // Une notification perdue ne doit pas faire échouer la commande qui l'a déclenchée.
  }
}

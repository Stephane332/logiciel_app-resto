/** Journal des opérations sensibles (§ 15.3 du cahier des charges). */
import { prisma } from '../db.js';

export interface AuditInput {
  restaurantId: string;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  data?: unknown;
  ip?: string;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        data: (input.data ?? null) as never,
        ip: input.ip ?? null,
      },
    });
  } catch {
    // Le journal ne doit jamais faire échouer l'opération métier qu'il observe.
  }
}

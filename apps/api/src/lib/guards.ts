/**
 * Garde-fous d'accès.
 *
 * Toute route protégée passe par ici. Les permissions sont vérifiées côté serveur à chaque requête :
 * le masquage dans l'interface est une politesse, jamais une sécurité (§ 12 du cahier des charges).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type Ability, can } from '@savora/shared';
import type { Role } from '@prisma/client';
import { forbidden, unauthorized } from './errors.js';
import { verifyAccessToken } from './auth.js';

export interface AuthContext {
  userId: string;
  role: Role;
  restaurantId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Renseigne `request.auth` si un jeton valide est présent, sans jamais refuser la requête. */
export async function attachAuth(request: FastifyRequest): Promise<void> {
  const token = extractToken(request);
  if (!token) return;
  try {
    const payload = await verifyAccessToken(token);
    request.auth = { userId: payload.sub, role: payload.role, restaurantId: payload.restaurantId };
  } catch {
    // Jeton invalide : la requête continue en anonyme. Les routes protégées la refuseront.
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.auth) throw unauthorized();
}

/** Exige une permission précise. Le message nomme la permission manquante, pour un support efficace. */
export function requireAbility(ability: Ability) {
  return async function guard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.auth) throw unauthorized();
    if (!can(request.auth.role, ability)) {
      throw forbidden(`Votre rôle (${request.auth.role}) ne permet pas : ${ability}.`);
    }
  };
}

/** Réserve l'accès au personnel du restaurant. */
export async function requireStaff(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.auth) throw unauthorized();
  if (request.auth.role === 'CLIENT') throw forbidden('Accès réservé au personnel du restaurant.');
}

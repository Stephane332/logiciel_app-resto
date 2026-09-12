/**
 * Authentification : jetons et mots de passe.
 *
 * Le jeton d'accès est court et sans état ; le jeton de rafraîchissement est long mais révocable et
 * stocké haché. Une fuite de la base ne donne donc aucune session utilisable.
 */
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';
import { env } from '../env.js';
import { unauthorized } from './errors.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  restaurantId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, restaurantId: payload.restaurantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.role !== 'string' || typeof payload.restaurantId !== 'string') {
      throw unauthorized('Jeton incomplet.');
    }
    return {
      sub: payload.sub,
      role: payload.role as Role,
      restaurantId: payload.restaurantId,
    };
  } catch {
    throw unauthorized('Session expirée ou invalide.');
  }
}

/** Jeton de rafraîchissement : valeur aléatoire côté client, empreinte seule côté serveur. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

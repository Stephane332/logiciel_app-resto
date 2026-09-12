/**
 * Résolution du restaurant courant.
 *
 * La V1 sert un seul établissement, mais toute requête porte déjà un restaurantId : le jour où un
 * second restaurant arrive, seule cette fonction change (ADR 004).
 */
import { prisma } from '../db.js';
import { notFound } from './errors.js';

let cachedId: string | null = null;

export async function currentRestaurantId(): Promise<string> {
  if (cachedId) return cachedId;
  const restaurant = await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!restaurant) {
    throw notFound("Aucun restaurant n'est configuré. Lancez l'amorçage de la base (npm run db:seed).");
  }
  cachedId = restaurant.id;
  return cachedId;
}

export function resetRestaurantCache(): void {
  cachedId = null;
}

/**
 * Envoi des photos de produits.
 *
 * Réservé au personnel habilité à tenir le menu : une route d'envoi de fichiers ouverte à tous est
 * un disque dur offert à Internet.
 */
import type { FastifyInstance } from 'fastify';
import { currentRestaurantId } from '../../lib/context.js';
import { badRequest } from '../../lib/errors.js';
import { requireAbility } from '../../lib/guards.js';
import { MAX_UPLOAD_BYTES, isAcceptedImageType, storeProductImage } from './service.js';

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/uploads/image', { preHandler: requireAbility('menu:write') }, async (request) => {
    const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
    if (!file) throw badRequest('NO_FILE', 'Aucune photo reçue.');

    if (!isAcceptedImageType(file.mimetype)) {
      throw badRequest('UNSUPPORTED_IMAGE', 'Envoyez une photo au format JPEG, PNG, WebP ou HEIC.');
    }

    const buffer = await file.toBuffer();
    // `toBuffer` s'arrête à la limite sans prévenir : sans ce contrôle, une photo trop lourde
    // serait enregistrée tronquée, et le restaurant verrait une image à moitié grise sans
    // comprendre pourquoi.
    if (file.file.truncated) {
      throw badRequest('IMAGE_TOO_LARGE', "Cette photo dépasse 12 Mo. Réduisez-la avant de l'envoyer.");
    }

    const restaurantId = await currentRestaurantId();
    const stored = await storeProductImage(restaurantId, buffer, file.mimetype);

    return stored;
  });
}

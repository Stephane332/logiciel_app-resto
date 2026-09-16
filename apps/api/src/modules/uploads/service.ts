/**
 * Photos des produits.
 *
 * Le restaurant photographie son plat avec son téléphone et l'envoie. Rien d'autre ne serait
 * utilisable : demander à un restaurateur de Ouahigouya d'héberger ses images ailleurs et d'en
 * coller l'adresse, c'est garantir un catalogue sans photos.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une photo reçue est toujours retraitée. Jamais servie telle quelle.          │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Deux raisons, et la première est décisive ici :
 *
 *   — **Les données coûtent cher.** Un téléphone récent produit des photos de 4 à 8 Mo. Servir cela
 *     à un client sur un forfait compté, c'est lui faire payer son menu avant qu'il ait commandé —
 *     et le faire partir. Chaque image est ramenée à 1 200 px de large en WebP, soit 60 à 120 Ko,
 *     accompagnée d'une vignette de 400 px pour les listes. Un menu de trente plats passe ainsi de
 *     150 Mo à moins de 3 Mo.
 *   — **Un fichier reçu n'est pas une image.** Le décoder et le réencoder soi-même écarte tout ce
 *     qui se cacherait derrière une extension : ce qui ressort est produit par la bibliothèque, pas
 *     par celui qui a envoyé le fichier. Les métadonnées EXIF disparaissent au passage, et avec
 *     elles les coordonnées GPS que le téléphone du gérant glisse dans chaque cliché.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { env } from '../../env.js';
import { badRequest, unprocessable } from '../../lib/errors.js';

/** Largeur de l'image servie sur la fiche produit. Au-delà, l'œil ne gagne rien sur un téléphone. */
const FULL_WIDTH = 1200;
/** Vignette des listes et du panier. */
const THUMB_WIDTH = 400;

/**
 * Plafond de l'original accepté, avant traitement.
 * Généreux : une photo de téléphone moderne dépasse souvent 8 Mo, et refuser le cliché que le gérant
 * vient de prendre serait absurde. C'est ce qui sort qui doit être léger, pas ce qui entre.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']);

export interface StoredImage {
  /** Adresse de l'image pleine, à enregistrer sur le produit. */
  url: string;
  /** Adresse de la vignette. */
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export function isAcceptedImageType(mimetype: string): boolean {
  return ACCEPTED.has(mimetype.toLowerCase());
}

/**
 * Enregistre une photo et renvoie ses adresses.
 *
 * Le nom du fichier est tiré au sort, jamais repris de celui qui a été envoyé : un nom fourni par
 * l'extérieur finit tôt ou tard par contenir un chemin, et un chemin fourni par l'extérieur finit
 * par écrire là où il ne devrait pas. Le hachage du contenu sert seulement à ne pas stocker deux
 * fois la même photo.
 */
export async function storeProductImage(
  restaurantId: string,
  buffer: Buffer,
  mimetype: string,
): Promise<StoredImage> {
  if (!isAcceptedImageType(mimetype)) {
    throw badRequest('UNSUPPORTED_IMAGE', 'Envoyez une photo au format JPEG, PNG, WebP ou HEIC.');
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw badRequest('IMAGE_TOO_LARGE', 'Cette photo dépasse 12 Mo. Réduisez-la avant de l\'envoyer.');
  }

  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    // `failOn: 'error'` refuse une image tronquée plutôt que d'en servir la moitié.
    pipeline = sharp(buffer, { failOn: 'error' });
    metadata = await pipeline.metadata();
  } catch {
    throw unprocessable('UNREADABLE_IMAGE', "Ce fichier n'est pas une image lisible.");
  }

  if (!metadata.width || !metadata.height) {
    throw unprocessable('UNREADABLE_IMAGE', "Ce fichier n'est pas une image lisible.");
  }

  const folder = join(env.UPLOAD_DIR, restaurantId);
  await mkdir(folder, { recursive: true });

  const stem = `${createHash('sha256').update(buffer).digest('hex').slice(0, 16)}-${randomUUID().slice(0, 8)}`;

  // `rotate()` sans argument applique l'orientation EXIF puis l'efface : sans cela, une photo prise
  // en tenant le téléphone de travers s'afficherait couchée.
  const base = () => sharp(buffer, { failOn: 'error' }).rotate();

  const full = await base()
    .resize({ width: FULL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  await Promise.all([
    writeFile(join(folder, `${stem}.webp`), full.data),
    writeFile(join(folder, `${stem}-vignette.webp`), thumb),
  ]);

  return {
    url: `/media/${restaurantId}/${stem}.webp`,
    thumbUrl: `/media/${restaurantId}/${stem}-vignette.webp`,
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.byteLength,
  };
}

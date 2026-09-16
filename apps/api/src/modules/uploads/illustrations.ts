/**
 * Visuel de repli d'un plat sans photo.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Ce ne sont pas des photographies. Ce sont des illustrations.                │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Une photographie inventée serait pire que rien : le client commanderait un plat qu'il a cru voir,
 * et découvrirait autre chose. Ces visuels ne prétendent donc pas être des photos — ils posent une
 * silhouette sur une lumière chaude, disent la catégorie d'un coup d'œil, et ne mentent pas sur le
 * contenu de l'assiette.
 *
 * Quand le restaurant crée un plat sans y joindre de photo, le logiciel lui en dessine une à
 * partir de son nom. Une case vide dans un menu donne l'impression d'un restaurant qui n'a pas
 * fini de s'installer, et un plat sans image se commande beaucoup moins. Le restaurant remplace
 * ce visuel par sa vraie photo quand il veut, depuis son téléphone.
 *
 * **Deux plats ne doivent jamais se ressembler.** La première version de ce fichier ne faisait
 * varier que la teinte : les quatre burgers étaient la même image en quatre couleurs, ce qui se
 * voyait immédiatement et donnait l'impression d'un menu bâclé. Tout est donc tiré du nom du
 * produit — la teinte, l'inclinaison, l'échelle, la position de la lumière et les accents — et
 * reste stable d'une génération à l'autre.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { env } from '../../env.js';

const WIDTH = 1200;
const HEIGHT = 900;
const THUMB = 400;

export type Glyph = 'burger' | 'wrap' | 'menu' | 'fries' | 'drink';

/** Suite déterministe tirée d'un nom : le même plat garde son apparence pour toujours. */
function seedOf(text: string): () => number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return ((hash >>> 0) % 1000) / 1000;
  };
}

const PATHS: Record<Glyph, string> = {
  burger:
    'M8 26c0-13 13-22 30-22s30 9 30 22zM6 33h64v5a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5zM8 50h60c0 9-7 14-16 14H24c-9 0-16-5-16-14z',
  wrap: 'M14 60 52 6c7-10 20-3 15 8L32 66c-4 9-16 6-18-6z',
  menu: 'M4 26c0-11 11-19 25-19s25 8 25 19zM2 32h54v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM4 47h50c0 8-6 12-13 12H17c-7 0-13-4-13-12z M64 8h10l-3 54a5 5 0 0 1-10 0z',
  fries: 'M18 30 12 6l9-2 6 25zM32 28 30 3h9l-2 25zM46 30l6-24 9 2-6 24zM10 35h54l-7 38a9 9 0 0 1-9 7H26a9 9 0 0 1-9-7z',
  drink: 'M18 4h38l-5 13H23zM21 21h32l-5 47a9 9 0 0 1-9 8h-4a9 9 0 0 1-9-8z',
};

/** Boîte de chaque silhouette, pour la centrer sans tâtonner. */
const BOXES: Record<Glyph, { w: number; h: number }> = {
  burger: { w: 68, h: 64 },
  wrap: { w: 68, h: 72 },
  menu: { w: 74, h: 62 },
  fries: { w: 66, h: 80 },
  drink: { w: 56, h: 76 },
};

function svg(name: string, glyph: Glyph): string {
  const rand = seedOf(name);

  // Les boissons partent vers le frais, tout le reste reste dans l'ambre et le brique : ce sont les
  // tons qui donnent faim.
  const hue = glyph === 'drink' ? 148 + Math.round(rand() * 64) : 6 + Math.round(rand() * 40);

  /*
   * Des tons clairs, pas des carrés sombres.
   *
   * La première version posait un sujet crème sur un fond très sombre. Sur l'ancienne interface en
   * vert nuit, cela passait ; sur le papier clair d'aujourd'hui, chaque vignette devient un bloc
   * lourd qui écrase la carte qui la porte. On inverse donc : un lavis chaud et lumineux, et le
   * sujet dessiné dans une teinte profonde. La vignette respire avec la page au lieu d'y faire un
   * trou.
   */
  const pale = `hsl(${hue} 62% 88%)`;
  const mid = `hsl(${(hue + 6) % 360} 70% 74%)`;
  const warm = `hsl(${(hue + 14) % 360} 88% 82%)`;
  const encre = `hsl(${hue} 58% 32%)`;

  // Ce qui distingue deux plats voisins : où tombe la lumière, comment la silhouette est posée.
  const lightX = (0.3 + rand() * 0.42).toFixed(3);
  const lightY = (0.22 + rand() * 0.26).toFixed(3);
  const tilt = (rand() * 14 - 7).toFixed(2);
  /*
   * Le sujet doit tenir dans le carré central, pas dans le cadre entier.
   *
   * L'image est produite en 4/3, mais elle est affichée recadrée : en 4/5 sur une carte en vedette,
   * en carré sur une vignette de liste. Une silhouette calée sur la largeur se retrouvait donc
   * tranchée des deux côtés. On la dimensionne sur la hauteur, avec de la marge — ce qui donne
   * aussi une image qui respire, là où la version précédente remplissait tout.
   */
  const scale = 0.52 + rand() * 0.12;
  const drift = (rand() * 6 - 3).toFixed(2);

  const box = BOXES[glyph];
  const cx = 60 + Number(drift);
  const cy = 43;

  // Trois accents, semés différemment selon le plat : graines sur un pain, bulles dans un verre.
  const accents = Array.from({ length: 3 }, (_, i) => {
    const ax = (26 + rand() * 68).toFixed(1);
    const ay = (14 + rand() * 58).toFixed(1);
    const ar = (0.8 + rand() * 1.5).toFixed(2);
    return `<circle cx="${ax}" cy="${ay}" r="${ar}" fill="#FFFFFF" fill-opacity="${0.28 + i * 0.08}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 120 90">
  <defs>
    <linearGradient id="fond" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${warm}"/>
      <stop offset="100%" stop-color="${mid}"/>
    </linearGradient>
    <radialGradient id="lumiere" cx="${lightX}" cy="${lightY}" r="0.72">
      <stop offset="0%" stop-color="${pale}" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="${pale}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${pale}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ombre" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#000" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="matiere" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${encre}"/>
      <stop offset="100%" stop-color="${encre}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.78">
      <stop offset="62%" stop-color="#7a4a1a" stop-opacity="0"/>
      <stop offset="100%" stop-color="#7a4a1a" stop-opacity="0.16"/>
    </radialGradient>
  </defs>

  <rect width="120" height="90" fill="url(#fond)"/>
  <rect width="120" height="90" fill="url(#lumiere)"/>
  ${accents}

  <!-- L'ombre portée pose l'objet : sans elle, la silhouette flotte et l'image reste plate. -->
  <ellipse cx="${cx}" cy="${cy + (box.h * scale) / 2 + 5}" rx="${(box.w * scale) / 1.8}" ry="4.5" fill="url(#ombre)"/>

  <g transform="translate(${cx} ${cy}) rotate(${tilt}) scale(${scale.toFixed(3)}) translate(${-box.w / 2} ${-box.h / 2})">
    <g fill="url(#matiere)" stroke="#FFFFFF" stroke-opacity="0.34" stroke-width="0.9"
       stroke-linejoin="round" stroke-linecap="round">
      <path d="${PATHS[glyph]}"/>
    </g>
  </g>

  <rect width="120" height="90" fill="url(#vignette)"/>
</svg>`;
}

export interface GeneratedImage {
  url: string;
  thumbUrl: string;
}

/**
 * Écrit l'illustration et sa vignette, aux mêmes emplacements et sous le même format que les photos
 * réellement envoyées par le restaurant — pour qu'une vraie photo prenne la place d'un visuel
 * d'attente sans rien changer d'autre.
 */
export async function generateIllustration(
  restaurantId: string,
  slug: string,
  glyph: Glyph,
): Promise<GeneratedImage> {
  const folder = join(env.UPLOAD_DIR, restaurantId);
  await mkdir(folder, { recursive: true });

  const source = Buffer.from(svg(slug, glyph));
  const stem = `demo-${slug}`;

  await Promise.all([
    sharp(source).resize(WIDTH, HEIGHT).webp({ quality: 88 }).toFile(join(folder, `${stem}.webp`)),
    sharp(source)
      .resize(THUMB, Math.round((THUMB * HEIGHT) / WIDTH))
      .webp({ quality: 82 })
      .toFile(join(folder, `${stem}-vignette.webp`)),
  ]);

  return {
    url: `/media/${restaurantId}/${stem}.webp`,
    thumbUrl: `/media/${restaurantId}/${stem}-vignette.webp`,
  };
}

/**
 * Devine la silhouette d'après ce que le restaurant a écrit — le nom du plat et celui de sa
 * catégorie. Deviner mal n'a pas grande conséquence : c'est une silhouette, pas une étiquette. Mais
 * deviner juste, le plus souvent, suffit à ce qu'un menu paraisse tenu.
 */
export function glyphFor(productName: string, categoryName = ''): Glyph {
  const text = `${productName} ${categoryName}`.toLowerCase();
  const has = (...words: string[]) => words.some((word) => text.includes(word));

  if (has('menu', 'formule', 'combo', 'duo')) return 'menu';
  if (has('boisson', 'jus', 'eau', 'soda', 'cola', 'fanta', 'bissap', 'thé', 'the ', 'café', 'cafe', 'lait', 'smoothie', 'bière', 'biere')) {
    return 'drink';
  }
  if (has('frite', 'accompagnement', 'salade', 'riz', 'attiéké', 'attieke', 'alloco', 'plantain', 'nugget', 'beignet')) {
    return 'fries';
  }
  if (has('wrap', 'panini', 'sandwich', 'shawarma', 'tacos', 'crêpe', 'crepe', 'galette')) return 'wrap';
  return 'burger';
}

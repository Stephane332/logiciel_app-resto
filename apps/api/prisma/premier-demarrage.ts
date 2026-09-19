/**
 * Premier démarrage chez un restaurant.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un vrai restaurant ne commence pas avec des hamburgers de démonstration      │
 * │  et un mot de passe publié dans le code source.                              │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * L'amorçage existant (`seed.ts`) crée un catalogue complet et cinq comptes dont le mot de passe est
 * écrit dans le dépôt. C'est ce qu'il faut pour démontrer et pour tester — et exactement ce qu'il ne
 * faut pas livrer. Un restaurateur qui découvre son logiciel plein de plats qu'il ne vend pas
 * commence par faire le ménage, et un mot de passe public sur une caisse est une porte ouverte.
 *
 * Ce script crée donc le minimum indispensable au démarrage : **le restaurant, et un seul compte
 * administrateur** dont le mot de passe est choisi par le restaurateur. Rien d'autre. Le menu, les
 * horaires, les tables et les zones de livraison sont ensuite saisis par lui, guidé par l'assistant
 * de configuration — c'est lui qui connaît ses plats et ses prix.
 *
 * Il est **idempotent** : relancé sur une base qui a déjà son restaurant, il ne touche à rien. Le
 * logiciel peut donc l'appeler à chaque démarrage sans réfléchir.
 *
 *   SAVORA_RESTO_NOM="Chez Awa" SAVORA_ADMIN_TEL="70112233" SAVORA_ADMIN_MDP="…" node dist/premier-demarrage.js
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { parseBurkinaPhone } from '@savora/shared';

const prisma = new PrismaClient();

/** Un identifiant lisible tiré du nom, pour les adresses web. */
function fabriquerSlug(nom: string): string {
  const base = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'restaurant';
}

async function main() {
  const nom = (process.env.SAVORA_RESTO_NOM ?? '').trim();
  const telephone = (process.env.SAVORA_ADMIN_TEL ?? '').trim();
  const motDePasse = process.env.SAVORA_ADMIN_MDP ?? '';

  const existant = await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existant) {
    console.log(`DEJA_CONFIGURE ${existant.name}`);
    return;
  }

  if (!nom || !telephone || !motDePasse) {
    throw new Error(
      'Premier démarrage : le nom du restaurant, le téléphone et le mot de passe de l\'administrateur sont requis.',
    );
  }
  // Huit caractères : ce n'est pas une politique de sécurité ambitieuse, c'est le minimum en dessous
  // duquel un mot de passe de caisse se devine en regardant l'employé le taper.
  if (motDePasse.length < 8) {
    throw new Error('Le mot de passe doit faire au moins 8 caractères.');
  }

  const analyse = parseBurkinaPhone(telephone);
  if (!analyse.ok || !analyse.e164) {
    throw new Error(`Numéro invalide : ${analyse.reason ?? telephone}`);
  }
  const numero = analyse.e164;

  const restaurant = await prisma.restaurant.create({
    data: {
      slug: fabriquerSlug(nom),
      name: nom,
      // Les couleurs par défaut de l'interface : le restaurateur mettra les siennes dans Paramètres.
      primaryColor: '#D95C14',
      backgroundColor: '#14342A',
      city: 'Ouahigouya',
      country: 'Burkina Faso',
      preparationMinutes: 20,
    },
  });

  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      phone: numero,
      name: 'Administrateur',
      role: 'ADMIN',
      passwordHash: await argon2.hash(motDePasse, { type: argon2.argon2id }),
      isActive: true,
    },
  });

  // Une ligne que le logiciel lit pour savoir que tout s'est bien passé.
  console.log(`CONFIGURE ${restaurant.name} ${numero}`);
}

main()
  .catch((erreur) => {
    console.error(`ECHEC ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

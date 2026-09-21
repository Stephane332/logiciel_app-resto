/**
 * Jeu de démarrage.
 *
 * Crée ce qui relève de la configuration — le restaurant, ses comptes, ses horaires, ses tables,
 * ses zones de livraison — et **rien du catalogue**.
 *
 * Aucun plat n'est créé ici. Tout ce qui apparaît dans l'application cliente doit avoir été saisi
 * par le restaurant depuis son logiciel : c'est la seule façon que le menu en ligne dise la vérité
 * sur ce qui sort réellement de la cuisine.
 *
 * Relancer ce script est sans danger : il met à jour au lieu de dupliquer.
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { generateTableToken } from '@savora/shared';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'savora2026';

/**
 * Ce script ne doit jamais s'exécuter sur une vraie installation.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Il crée cinq comptes dont le mot de passe est écrit dans un dépôt public.    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le guide de déploiement demandait de le lancer sur le serveur de production, avec un
 * avertissement en prose : « changez immédiatement ces mots de passe ». Un avertissement en prose
 * ne protège personne — il se lit une fois, se remet à plus tard, et le restaurant tourne des mois
 * avec cinq comptes dont le mot de passe se trouve sur Internet. N'importe qui pouvant joindre le
 * serveur ouvre alors la caisse, lit le chiffre d'affaires et annule des commandes.
 *
 * Pour créer un vrai restaurant, il existe `premier-demarrage.ts` : un seul compte, un mot de passe
 * choisi, rien de public. C'est lui qu'emploie le logiciel Windows, et c'est lui que le guide
 * indique désormais.
 *
 * Le refus se force — `SAVORA_AMORCAGE_DEMO=1` — parce qu'il faut bien pouvoir monter une
 * démonstration sur une machine de production le temps d'un rendez-vous. Mais alors on l'a voulu,
 * on l'a écrit, et cela se relit dans l'historique des commandes.
 */
function refuserEnProduction() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.SAVORA_AMORCAGE_DEMO === '1') {
    console.warn('\n  ⚠  Amorçage de démonstration forcé en production : mots de passe publics.\n');
    return;
  }
  console.error(
    [
      '',
      "  ⚠  Refus : ce jeu de démarrage crée des comptes dont le mot de passe est public.",
      '',
      '     Pour créer un vrai restaurant :',
      '       SAVORA_RESTO_NOM="Chez Awa" \\',
      '       SAVORA_ADMIN_TEL="70112233" \\',
      '       SAVORA_ADMIN_MDP="…" node dist/premier-demarrage.js',
      '',
      '     Pour une démonstration assumée : SAVORA_AMORCAGE_DEMO=1',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  refuserEnProduction();
  console.log('Amorçage de la base Savora…\n');

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'mon-restaurant' },
    // Les couleurs de marque sont réalignées à chaque amorçage. Sans cela, un restaurant créé sous
    // une ancienne palette garderait indéfiniment des couleurs qui jurent avec l'interface, et le
    // défaut serait invisible en développement puisque la base n'est jamais recréée.
    update: { primaryColor: '#D95C14', backgroundColor: '#14342A' },
    create: {
      slug: 'mon-restaurant',
      name: 'Mon restaurant',
      tagline: 'Bon goût. Sans attente.',
      primaryColor: '#D95C14',
      backgroundColor: '#14342A',
      city: 'Ouahigouya',
      country: 'Burkina Faso',
      address: 'Ouahigouya, Burkina Faso',
      preparationMinutes: 20,
    },
  });
  console.log(`Restaurant : ${restaurant.name} (${restaurant.city})`);

  // --- Horaires : 10h00 – 23h00, sept jours sur sept ------------------------
  for (let weekday = 0; weekday < 7; weekday += 1) {
    await prisma.openingHour.upsert({
      where: { restaurantId_weekday: { restaurantId: restaurant.id, weekday } },
      update: {},
      create: { restaurantId: restaurant.id, weekday, opensAt: 10 * 60, closesAt: 23 * 60 },
    });
  }
  console.log('Horaires : 10h00 – 23h00, tous les jours');

  // --- Comptes ---------------------------------------------------------------
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const staff = [
    { phone: '+22670000001', name: 'Administrateur', role: 'ADMIN' as const },
    { phone: '+22670000002', name: 'Gérant', role: 'MANAGER' as const },
    { phone: '+22670000003', name: 'Caisse', role: 'CASHIER' as const },
    { phone: '+22670000004', name: 'Cuisine', role: 'KITCHEN' as const },
    { phone: '+22670000005', name: 'Livreur', role: 'DELIVERY' as const },
  ];

  for (const member of staff) {
    await prisma.user.upsert({
      where: { restaurantId_phone: { restaurantId: restaurant.id, phone: member.phone } },
      update: { role: member.role, passwordHash },
      create: { restaurantId: restaurant.id, phone: member.phone, name: member.name, role: member.role, passwordHash },
    });
  }
  console.log(`Comptes : ${staff.length} employés (mot de passe : ${DEMO_PASSWORD})`);

  // --- Catalogue : volontairement vide ----------------------------------------
  //
  // Aucun produit n'est créé ici, et c'est une règle, pas un oubli.
  //
  // Tout ce qui apparaît dans l'application cliente doit avoir été saisi par le restaurant depuis
  // son logiciel. Un catalogue de démonstration livré d'avance donne une première impression
  // flatteuse et coûte cher ensuite : l'équipe ne sait plus ce qui vient d'elle, des plats qu'elle
  // ne fait pas restent en ligne, et un client finit par commander un produit qui n'existe pas.
  //
  // L'assistant de configuration prend le relais : le logiciel s'ouvre sur « ajoutez votre premier
  // plat », et l'application cliente affiche un menu vide tant que ce n'est pas fait. C'est la
  // vérité de l'état du restaurant, et c'est ce qu'il faut montrer.
  const productCount = await prisma.product.count({ where: { restaurantId: restaurant.id } });
  console.log(
    productCount === 0
      ? 'Catalogue : vide — à saisir depuis le logiciel restaurant.'
      : `Catalogue : ${productCount} produits déjà saisis par le restaurant, laissés intacts.`,
  );

  // --- Tables ----------------------------------------------------------------
  for (let index = 1; index <= 9; index += 1) {
    const number = String(index).padStart(2, '0');
    await prisma.restaurantTable.upsert({
      where: { restaurantId_number: { restaurantId: restaurant.id, number } },
      update: {},
      create: { restaurantId: restaurant.id, number, capacity: index <= 6 ? 4 : 6, qrToken: generateTableToken() },
    });
  }
  console.log('Tables : 9 tables avec QR Codes');

  // --- Zones de livraison ----------------------------------------------------
  // Exemples à remplacer par les secteurs réellement desservis à Ouahigouya.
  const zones = [
    { name: 'Secteur 1', fee: 500, minimumOrder: 2000, estimatedMinutes: 20 },
    { name: 'Secteur 2', fee: 500, minimumOrder: 2000, estimatedMinutes: 20 },
    { name: 'Secteur 3', fee: 750, minimumOrder: 2500, estimatedMinutes: 25 },
    { name: 'Secteur 4', fee: 1000, minimumOrder: 3000, estimatedMinutes: 30 },
    { name: 'Secteur 5', fee: 1000, minimumOrder: 3000, estimatedMinutes: 35 },
  ];
  for (const [index, zone] of zones.entries()) {
    await prisma.deliveryZone.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: zone.name } },
      update: {},
      create: { restaurantId: restaurant.id, ...zone, position: index },
    });
  }
  console.log(`Zones de livraison : ${zones.length} secteurs (à ajuster selon la réalité du terrain)`);

  // --- Promotion d'exemple ---------------------------------------------------
  await prisma.promotion.upsert({
    where: { restaurantId_code: { restaurantId: restaurant.id, code: 'BIENVENUE' } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      code: 'BIENVENUE',
      label: 'Bienvenue — 10 % sur la première commande',
      discountType: 'PERCENTAGE',
      value: 10,
      minimumOrder: 2000,
    },
  });

  console.log('\nAmorçage terminé.');
  console.log('Connexion au logiciel restaurant : 70 00 00 01 (administrateur)');
  console.log(`Mot de passe : ${DEMO_PASSWORD} — à changer avant toute mise en production.`);
}

main()
  .catch((error) => {
    console.error('Échec de l\'amorçage :', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

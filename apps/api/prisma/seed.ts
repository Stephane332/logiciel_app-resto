/**
 * Jeu de démarrage.
 *
 * Ce n'est PAS le menu d'Innova Group : c'est un point de départ pour que la plateforme soit
 * utilisable et démontrable dès la première minute. Le restaurant saisit ensuite son propre
 * catalogue depuis le logiciel restaurant, sans développeur (§ 2.8 du cahier des charges).
 *
 * Relancer ce script est sans danger : il met à jour au lieu de dupliquer.
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { generateTableToken } from '@barabite/shared';
import { generateIllustration, glyphForCategory } from './illustrations.js';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'barabite2026';

async function main() {
  console.log('Amorçage de la base BaraBite…\n');

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'innova-group' },
    update: {},
    create: {
      slug: 'innova-group',
      name: 'Innova Group',
      tagline: 'Bon goût. Sans attente.',
      primaryColor: '#F2B705',
      backgroundColor: '#0B1F17',
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

  // --- Catalogue de démarrage ------------------------------------------------
  const catalogue = [
    {
      name: 'Burgers',
      slug: 'burgers',
      products: [
        { name: 'Double Cheese', slug: 'double-cheese', price: 3500, description: 'Steak haché, cheddar, salade, tomate, oignon, sauce maison.', featured: true },
        { name: 'Chicken Burger', slug: 'chicken-burger', price: 2800, description: 'Poulet grillé, crudités, sauce.' },
        { name: 'Beef Burger', slug: 'beef-burger', price: 2500, description: 'Steak haché, salade, tomate, oignon.' },
        { name: 'Fish Burger', slug: 'fish-burger', price: 2500, description: 'Poisson pané, salade, sauce tartare.' },
      ],
    },
    {
      name: 'Paninis & Wraps',
      slug: 'paninis-wraps',
      products: [
        { name: 'Chicken Wrap', slug: 'chicken-wrap', price: 2900, description: 'Poulet, crudités, sauce au choix.' },
        { name: 'Panini Poulet', slug: 'panini-poulet', price: 2000, description: 'Pain panini, poulet, fromage fondu.' },
      ],
    },
    {
      name: 'Menus',
      slug: 'menus',
      products: [
        { name: 'Menu XL', slug: 'menu-xl', price: 6500, description: 'Double Cheese + frites + boisson.', featured: true },
        { name: 'Menu Poulet', slug: 'menu-poulet', price: 5500, description: 'Chicken Burger + frites + boisson.' },
        { name: 'Menu du moment', slug: 'menu-du-moment', price: 3500, description: 'Burger + frites + boisson.', featured: true },
      ],
    },
    {
      name: 'Accompagnements',
      slug: 'accompagnements',
      products: [
        { name: 'Frites', slug: 'frites', price: 1500, description: 'Frites maison, portion généreuse.' },
        { name: 'Frites Cheese', slug: 'frites-cheese', price: 2000, description: 'Frites nappées de cheddar fondu.' },
      ],
    },
    {
      name: 'Boissons',
      slug: 'boissons',
      products: [
        { name: 'Coca-Cola', slug: 'coca-cola', price: 1000, description: 'Canette 33 cl, bien fraîche.' },
        { name: 'Fanta', slug: 'fanta', price: 1000, description: 'Canette 33 cl.' },
        { name: 'Eau minérale', slug: 'eau-minerale', price: 500, description: 'Bouteille 50 cl.' },
        { name: 'Jus de bissap', slug: 'jus-de-bissap', price: 750, description: 'Préparation maison, servie fraîche.' },
      ],
    },
  ];

  const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  let productCount = 0;
  for (const [categoryIndex, group] of catalogue.entries()) {
    const category = await prisma.category.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug: group.slug } },
      update: { position: categoryIndex },
      create: { restaurantId: restaurant.id, name: group.name, slug: group.slug, position: categoryIndex },
    });

    for (const [productIndex, item] of group.products.entries()) {
      const existing = await prisma.product.findUnique({
        where: { restaurantId_slug: { restaurantId: restaurant.id, slug: item.slug } },
      });
      if (existing) {
        productCount += 1;
        continue;
      }

      // Visuel d'attente : une illustration, jamais une fausse photographie. Un menu sans aucune
      // image se commande beaucoup moins, mais une photo inventée ferait commander un plat que le
      // client ne recevra pas.
      const illustration = await generateIllustration(
        uploadDir,
        restaurant.id,
        item.slug,
        glyphForCategory(group.slug),
      );

      const product = await prisma.product.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          price: item.price,
          imageUrl: illustration.url,
          position: productIndex,
          isFeatured: 'featured' in item ? Boolean(item.featured) : false,
        },
      });
      productCount += 1;

      // Sauces et suppléments sur les produits qui s'y prêtent.
      if (group.slug === 'burgers' || group.slug === 'paninis-wraps' || group.slug === 'menus') {
        const sauces = await prisma.optionGroup.create({
          data: { productId: product.id, name: 'Choisissez une sauce', minChoices: 1, maxChoices: 1, position: 0 },
        });
        await prisma.optionItem.createMany({
          data: [
            { groupId: sauces.id, name: 'Sauce maison', priceDelta: 0, position: 0 },
            { groupId: sauces.id, name: 'Mayonnaise', priceDelta: 0, position: 1 },
            { groupId: sauces.id, name: 'Ketchup', priceDelta: 0, position: 2 },
            { groupId: sauces.id, name: 'Piment', priceDelta: 0, position: 3 },
          ],
        });

        const extras = await prisma.optionGroup.create({
          data: { productId: product.id, name: 'Suppléments', minChoices: 0, maxChoices: 4, position: 1 },
        });
        await prisma.optionItem.createMany({
          data: [
            { groupId: extras.id, name: 'Fromage supplémentaire', priceDelta: 500, position: 0 },
            { groupId: extras.id, name: 'Œuf', priceDelta: 300, position: 1 },
            { groupId: extras.id, name: 'Bacon', priceDelta: 500, position: 2 },
          ],
        });
      }
    }
  }
  console.log(`Catalogue de démarrage : ${catalogue.length} catégories, ${productCount} produits`);

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

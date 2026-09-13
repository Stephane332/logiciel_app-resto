/**
 * Menu : consultation publique et gestion par le restaurant.
 *
 * Le menu est **public** : le consulter n'exige aucun compte. C'est la condition pour qu'un lien
 * partagé sur TikTok ou Facebook mène directement au menu, et pour qu'un QR Code de table ouvre la
 * carte sans installation (§ 2.3).
 *
 * Le catalogue est saisi par le restaurant lui-même : rien n'est codé en dur (§ 2.8).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { categoryInputSchema, productInputSchema } from '@barabite/shared';
import { prisma } from '../../db.js';
import { currentRestaurantId } from '../../lib/context.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { requireAbility, requireStaff } from '../../lib/guards.js';
import { audit } from '../../lib/audit.js';
import { emitToRestaurant } from '../../lib/realtime.js';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Un produit est commandable s'il est actif et, lorsqu'un stock est suivi, s'il en reste (§ 2.6). */
function isOrderable(product: { isAvailable: boolean; stock: number | null }): boolean {
  return product.isAvailable && (product.stock === null || product.stock > 0);
}

const productInclude = {
  optionGroups: {
    orderBy: { position: 'asc' },
    include: { items: { orderBy: { position: 'asc' } } },
  },
} as const;

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  // --- Consultation publique ------------------------------------------------

  app.get('/menu', async (_request, reply) => {
    const restaurantId = await currentRestaurantId();

    const categories = await prisma.category.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { position: 'asc' },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { position: 'asc' },
          include: productInclude,
        },
      },
    });

    return reply.send({
      categories: categories.map((category) => ({
        ...category,
        products: category.products.map((product) => ({
          ...product,
          // Le stock exact ne regarde pas le client ; seul compte « commandable ou non ».
          stock: undefined,
          isOrderable: isOrderable(product),
        })),
      })),
    });
  });

  app.get('/menu/products/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const product = await prisma.product.findUnique({
      where: { restaurantId_slug: { restaurantId, slug } },
      include: { ...productInclude, category: true },
    });

    if (!product || !product.isAvailable) throw notFound('Ce produit n\'est pas disponible.');

    return reply.send({
      product: { ...product, stock: undefined, isOrderable: isOrderable(product) },
    });
  });

  // --- Gestion du catalogue -------------------------------------------------

  /**
   * Vue de gestion : stock réel, produits désactivés, catégories inactives.
   * `menu:read` seul ne suffit pas — les clients l'ont aussi, puisqu'ils consultent la carte.
   * L'accès est donc réservé au personnel.
   */
  app.get('/menu/manage', { preHandler: [requireStaff, requireAbility('menu:read')] }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();
    const categories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { position: 'asc' },
      include: { products: { orderBy: { position: 'asc' }, include: productInclude } },
    });
    return reply.send({ categories });
  });

  app.post('/menu/categories', { preHandler: requireAbility('menu:write') }, async (request, reply) => {
    const body = categoryInputSchema.parse(request.body);
    const restaurantId = await currentRestaurantId();

    const category = await prisma.category.create({
      data: {
        restaurantId,
        name: body.name,
        slug: await uniqueSlug('category', restaurantId, slugify(body.name)),
        description: body.description ?? null,
        imageUrl: body.imageUrl || null,
        position: body.position,
        isActive: body.isActive,
      },
    });

    emitToRestaurant(restaurantId, 'menu:updated', { categoryId: category.id });
    return reply.status(201).send({ category });
  });

  app.patch('/menu/categories/:id', { preHandler: requireAbility('menu:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = categoryInputSchema.partial().parse(request.body);
    const restaurantId = await currentRestaurantId();

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description ?? null }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    emitToRestaurant(restaurantId, 'menu:updated', { categoryId: category.id });
    return reply.send({ category });
  });

  app.delete('/menu/categories/:id', { preHandler: requireAbility('menu:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      // Supprimer une catégorie pleine détruirait des produits — et l'historique qui les référence.
      throw badRequest(
        'CATEGORY_NOT_EMPTY',
        `Cette catégorie contient ${productCount} produit(s). Déplacez-les ou désactivez la catégorie.`,
      );
    }

    await prisma.category.delete({ where: { id } });
    emitToRestaurant(restaurantId, 'menu:updated', { categoryId: id });
    return reply.send({ ok: true });
  });

  app.post('/menu/products', { preHandler: requireAbility('menu:write') }, async (request, reply) => {
    const body = productInputSchema.parse(request.body);
    const restaurantId = await currentRestaurantId();

    const category = await prisma.category.findFirst({
      where: { id: body.categoryId, restaurantId },
    });
    if (!category) throw notFound('Catégorie introuvable.');

    const product = await prisma.product.create({
      data: {
        restaurantId,
        categoryId: body.categoryId,
        name: body.name,
        slug: await uniqueSlug('product', restaurantId, slugify(body.name)),
        description: body.description ?? null,
        price: body.price,
        imageUrl: body.imageUrl || null,
        isAvailable: body.isAvailable,
        stock: body.stock ?? null,
        position: body.position,
        optionGroups: {
          create: body.optionGroups.map((group) => ({
            name: group.name,
            minChoices: group.minChoices,
            maxChoices: group.maxChoices,
            position: group.position,
            items: {
              create: group.items.map((item) => ({
                name: item.name,
                priceDelta: item.priceDelta,
                isAvailable: item.isAvailable,
                position: item.position,
              })),
            },
          })),
        },
      },
      include: productInclude,
    });

    await audit({
      restaurantId,
      actorId: request.auth?.userId,
      action: 'product.create',
      targetType: 'product',
      targetId: product.id,
      data: { name: product.name, price: product.price },
    });

    emitToRestaurant(restaurantId, 'menu:updated', { productId: product.id });
    return reply.status(201).send({ product });
  });

  app.patch('/menu/products/:id', { preHandler: requireAbility('menu:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = productInputSchema.partial().parse(request.body);
    const restaurantId = await currentRestaurantId();

    const before = await prisma.product.findFirst({ where: { id, restaurantId } });
    if (!before) throw notFound('Produit introuvable.');

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.description !== undefined && { description: body.description ?? null }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
        ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
        ...(body.stock !== undefined && { stock: body.stock ?? null }),
        ...(body.position !== undefined && { position: body.position }),
      },
      include: productInclude,
    });

    // Un changement de prix est journalisé : c'est une opération sensible (§ 15.3).
    if (body.price !== undefined && body.price !== before.price) {
      await audit({
        restaurantId,
        actorId: request.auth?.userId,
        action: 'product.price_change',
        targetType: 'product',
        targetId: product.id,
        data: { from: before.price, to: product.price },
      });
    }

    emitToRestaurant(restaurantId, 'menu:updated', { productId: product.id });
    return reply.send({ product });
  });

  /**
   * Bascule rapide de disponibilité — le geste le plus fréquent en service.
   * Accessible à la cuisine : c'est elle qui sait ce qui manque, et elle ne peut pas toucher aux prix.
   */
  app.patch('/menu/products/:id/availability', { preHandler: requireAbility('stock:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({ isAvailable: z.boolean().optional(), stock: z.number().int().min(0).nullable().optional() })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const existing = await prisma.product.findFirst({ where: { id, restaurantId } });
    if (!existing) throw notFound('Produit introuvable.');

    const stock = body.stock !== undefined ? body.stock : existing.stock;
    // Un stock à zéro rend le produit indisponible sans qu'on ait à y penser : c'est exactement au
    // moment du coup de feu qu'on oublie de le faire à la main.
    const isAvailable =
      body.isAvailable !== undefined ? body.isAvailable : stock === null || stock > 0;

    const product = await prisma.product.update({
      where: { id },
      data: { isAvailable: stock !== null && stock <= 0 ? false : isAvailable, stock },
    });

    emitToRestaurant(restaurantId, 'menu:updated', { productId: product.id });
    return reply.send({ product });
  });

  app.delete('/menu/products/:id', { preHandler: requireAbility('menu:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const restaurantId = await currentRestaurantId();

    const ordered = await prisma.orderItem.count({ where: { productId: id } });
    if (ordered > 0) {
      // Le produit a une histoire : on le retire du menu sans effacer les commandes passées.
      const product = await prisma.product.update({
        where: { id },
        data: { isAvailable: false, position: 999 },
      });
      emitToRestaurant(restaurantId, 'menu:updated', { productId: id });
      return reply.send({
        product,
        archived: true,
        message: 'Produit déjà commandé : il est retiré du menu mais conservé pour l\'historique.',
      });
    }

    await prisma.product.delete({ where: { id } });
    emitToRestaurant(restaurantId, 'menu:updated', { productId: id });
    return reply.send({ ok: true, archived: false });
  });
}

async function uniqueSlug(
  kind: 'category' | 'product',
  restaurantId: string,
  base: string,
): Promise<string> {
  const root = base || kind;
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`;
    const exists =
      kind === 'category'
        ? await prisma.category.findUnique({ where: { restaurantId_slug: { restaurantId, slug: candidate } } })
        : await prisma.product.findUnique({ where: { restaurantId_slug: { restaurantId, slug: candidate } } });
    if (!exists) return candidate;
  }
  return `${root}-${Date.now()}`;
}

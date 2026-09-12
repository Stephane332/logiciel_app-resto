/** Employés et rôles. Réservé à l'administrateur : distribuer des accès est une décision sensible. */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { employeeInputSchema, parseBurkinaPhone, ROLES } from '@barabite/shared';
import { prisma } from '../../db.js';
import { currentRestaurantId } from '../../lib/context.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { requireAbility } from '../../lib/guards.js';
import { hashPassword } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/employees', { preHandler: requireAbility('employee:write') }, async (_request, reply) => {
    const restaurantId = await currentRestaurantId();
    const employees = await prisma.user.findMany({
      where: { restaurantId, role: { not: 'CLIENT' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, role: true, isActive: true, lastSeenAt: true, createdAt: true },
    });
    return reply.send({ employees });
  });

  app.post('/employees', { preHandler: requireAbility('employee:write') }, async (request, reply) => {
    const body = employeeInputSchema.parse(request.body);
    const restaurantId = await currentRestaurantId();
    const phone = parseBurkinaPhone(body.phone).e164!;

    const existing = await prisma.user.findUnique({ where: { restaurantId_phone: { restaurantId, phone } } });
    if (existing && existing.role !== 'CLIENT') {
      throw conflict('PHONE_TAKEN', 'Un employé utilise déjà ce numéro.');
    }

    // Un client existant peut être promu employé : il garde son historique et ses points.
    const employee = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name: body.name, role: body.role, isActive: body.isActive, passwordHash: await hashPassword(body.password) },
        })
      : await prisma.user.create({
          data: {
            restaurantId,
            phone,
            name: body.name,
            role: body.role,
            isActive: body.isActive,
            passwordHash: await hashPassword(body.password),
          },
        });

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'employee.create',
      targetType: 'user',
      targetId: employee.id,
      data: { role: employee.role },
    });

    return reply.status(201).send({
      employee: { id: employee.id, name: employee.name, phone: employee.phone, role: employee.role, isActive: employee.isActive },
    });
  });

  app.patch('/employees/:id', { preHandler: requireAbility('employee:write') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        role: z.enum(ROLES).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(6).max(128).optional(),
      })
      .parse(request.body);
    const restaurantId = await currentRestaurantId();

    const existing = await prisma.user.findFirst({ where: { id, restaurantId } });
    if (!existing) throw notFound('Employé introuvable.');

    // Se retirer soi-même ses propres droits est le meilleur moyen de se verrouiller dehors.
    if (id === request.auth!.userId && (body.role !== undefined || body.isActive === false)) {
      throw badRequest('SELF_LOCKOUT', 'Vous ne pouvez pas modifier votre propre rôle ni vous désactiver.');
    }

    const employee = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.password !== undefined && { passwordHash: await hashPassword(body.password) }),
      },
    });

    // Les sessions ouvertes d'un compte désactivé ou rétrogradé doivent tomber immédiatement.
    if (body.isActive === false || body.role !== undefined) {
      await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await audit({
      restaurantId,
      actorId: request.auth!.userId,
      action: 'employee.update',
      targetType: 'user',
      targetId: id,
      data: { role: employee.role, isActive: employee.isActive },
    });

    return reply.send({
      employee: { id: employee.id, name: employee.name, phone: employee.phone, role: employee.role, isActive: employee.isActive },
    });
  });
}

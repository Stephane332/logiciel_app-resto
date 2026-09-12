/**
 * Schémas de validation partagés.
 *
 * Le même schéma valide la saisie côté interface et la requête côté serveur. Le serveur revalide
 * toujours : partager le schéma évite la divergence, il ne délègue pas la confiance.
 */
import { z } from 'zod';
import { ORDER_CHANNELS, ORDER_TYPES, PAYMENT_METHODS, REJECTION_REASONS, ROLES } from './enums.js';
import { isValidBurkinaPhone } from './phone.js';

/** Un montant : entier positif ou nul, en FCFA (ADR 003). */
export const amountSchema = z
  .number()
  .int('Les montants en FCFA sont des entiers.')
  .min(0, 'Un montant ne peut pas être négatif.');

export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidBurkinaPhone, 'Numéro de téléphone burkinabè invalide (8 chiffres).');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nom trop court.')
  .max(80, 'Nom trop long.');

// --- Authentification ------------------------------------------------------

export const registerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: z.string().trim().email('Adresse électronique invalide.').optional().or(z.literal('')),
  /** Optionnel : commander ne doit pas exiger de mot de passe (§ 2.2 du cahier des charges). */
  password: z.string().min(6, 'Au moins 6 caractères.').max(128).optional(),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Mot de passe requis.'),
});

// --- Menu ------------------------------------------------------------------

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(280).optional(),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const optionItemInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  priceDelta: amountSchema.default(0),
  isAvailable: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

export const optionGroupInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    minChoices: z.number().int().min(0).max(20).default(0),
    maxChoices: z.number().int().min(1).max(20).default(1),
    position: z.number().int().min(0).default(0),
    items: z.array(optionItemInputSchema).min(1, 'Un groupe doit proposer au moins une option.'),
  })
  .refine((group) => group.maxChoices >= group.minChoices, {
    message: 'Le maximum de choix doit être supérieur ou égal au minimum.',
    path: ['maxChoices'],
  });

export const productInputSchema = z.object({
  categoryId: z.string().min(1, 'Catégorie requise.'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  price: amountSchema,
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
  isAvailable: z.boolean().default(true),
  /** `null` = pas de suivi de stock pour ce produit. */
  stock: z.number().int().min(0).nullable().optional(),
  position: z.number().int().min(0).default(0),
  optionGroups: z.array(optionGroupInputSchema).default([]),
});

// --- Commande --------------------------------------------------------------

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  optionItemIds: z.array(z.string().min(1)).default([]),
  note: z.string().trim().max(200).optional(),
});

export const deliveryAddressSchema = z.object({
  /** Ouahigouya se repère par secteur et point de repère, pas par adresse postale (§ 10). */
  sector: z.string().trim().min(1, 'Secteur requis.').max(40),
  district: z.string().trim().max(80).optional(),
  landmark: z.string().trim().min(3, 'Indiquez un point de repère.').max(200),
  details: z.string().trim().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const createOrderSchema = z
  .object({
    type: z.enum(ORDER_TYPES),
    channel: z.enum(ORDER_CHANNELS).default('APP'),
    lines: z.array(cartLineSchema).min(1, 'Le panier est vide.'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    /** Total attendu par le client : le serveur le recalcule et refuse tout écart (A4). */
    expectedTotal: amountSchema.optional(),
    customerName: nameSchema.optional(),
    customerPhone: phoneSchema.optional(),
    note: z.string().trim().max(300).optional(),
    address: deliveryAddressSchema.optional(),
    addressId: z.string().optional(),
    deliveryZoneId: z.string().optional(),
    tableToken: z.string().min(10).max(64).optional(),
    scheduledFor: z.string().datetime().optional(),
    loyaltyPointsToUse: z.number().int().min(0).optional(),
    promotionCode: z.string().trim().max(30).optional(),
  })
  .superRefine((order, ctx) => {
    if (order.type === 'DELIVERY' && !order.address && !order.addressId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Une adresse de livraison est requise.',
        path: ['address'],
      });
    }
    if (order.type === 'DINE_IN' && !order.tableToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scannez le QR Code de la table.',
        path: ['tableToken'],
      });
    }
  });

export const rejectOrderSchema = z.object({
  reason: z.enum(REJECTION_REASONS),
  comment: z.string().trim().max(300).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Un motif est obligatoire.').max(300),
});

// --- Administration --------------------------------------------------------

export const employeeInputSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  role: z.enum(ROLES).refine((role) => role !== 'CLIENT', 'Rôle employé requis.'),
  password: z.string().min(6).max(128),
  isActive: z.boolean().default(true),
});

export const deliveryZoneInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  fee: amountSchema,
  minimumOrder: amountSchema.default(0),
  estimatedMinutes: z.number().int().min(1).max(180).default(30),
  isActive: z.boolean().default(true),
});

export const brandInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(120).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue, par exemple #F2B705.')
    .optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  phone: phoneSchema.optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
});

export const openingHourInputSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opensAt: z.number().int().min(0).max(1439),
    closesAt: z.number().int().min(0).max(1439),
    closed: z.boolean().default(false),
  })
  .refine((hour) => hour.closed || hour.opensAt !== hour.closesAt, {
    message: "L'ouverture et la fermeture ne peuvent pas coïncider.",
    path: ['closesAt'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type EmployeeInput = z.infer<typeof employeeInputSchema>;
export type DeliveryZoneInput = z.infer<typeof deliveryZoneInputSchema>;
export type BrandInput = z.infer<typeof brandInputSchema>;
export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(100),
  businessName: z.string().trim().min(2).max(120),
  businessSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(80),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;
export * from './product-master.js';
export * from './party-master.js';
export * from './inventory.js';
export * from './purchase.js';
export * from './sale.js';
export * from './return.js';

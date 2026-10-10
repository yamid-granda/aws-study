import { z } from "zod";

export const productSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  price: z.number().positive().finite(),
  stock: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  price: z.number().positive().finite(),
  stock: z.number().int().min(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name, description, price, stock) is required",
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const productIdSchema = z.object({
  id: z.string().min(1).max(100),
});

export function buildProduct(input: CreateProductInput): Product {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

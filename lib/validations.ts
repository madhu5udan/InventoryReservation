import { z } from 'zod';

// Reservation validation
export const CreateReservationSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const CreateReservationParamsSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
});

// Product validation
export const ProductQuerySchema = z.object({
  warehouseId: z.string().optional(),
});

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;

// Warehouse validation
export const WarehouseQuerySchema = z.object({
  limit: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  offset: z.string().optional().transform(v => v ? parseInt(v) : undefined),
});

export type WarehouseQueryInput = z.infer<typeof WarehouseQuerySchema>;

// Idempotency key
export const IdempotencyKeySchema = z.object({
  'idempotency-key': z.string().uuid().optional(),
});

export type IdempotencyKeyInput = z.infer<typeof IdempotencyKeySchema>;

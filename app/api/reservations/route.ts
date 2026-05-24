import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  successResponse,
  conflictResponse,
  notFoundResponse,
  createdResponse,
  handleApiError,
} from '@/lib/api-response';
import { CreateReservationSchema } from '@/lib/validations';
import { createReservationSafe, handleExpiredReservations } from '@/lib/reservation';
import { ERROR_CODES } from '@/lib/types';
import { ZodError } from 'zod';

const prisma = new PrismaClient();

/**
 * Get all pending reservations
 * 
 * Returns all non-expired PENDING reservations with product and warehouse details.
 * Used by the frontend to display reservations that can be resumed.
 * 
 * This endpoint automatically expires any reservations that have passed their expiration time.
 */
export async function GET(request: NextRequest) {
  try {
    // First, expire any reservations that have passed their expiration time
    await handleExpiredReservations();

    // Then fetch all remaining pending reservations with product and warehouse details
    const pendingReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          gt: new Date(), // Only non-expired reservations
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: {
        expiresAt: 'asc', // Show soonest-to-expire first
      },
    });

    return successResponse(pendingReservations);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Create a new reservation - idempotent endpoint
 * 
 * Idempotency: If a client retries this request with the same Idempotency-Key header,
 * the server will return the original response without creating a duplicate reservation.
 * 
 * This uses database-level idempotency where the Idempotency-Key is stored as a unique
 * constraint on the Reservation table, ensuring only one reservation per key.
 * 
 * Headers:
 *   Idempotency-Key: Optional unique key (UUID recommended) for request idempotency
 *                    If provided and a reservation with this key exists, that reservation is returned
 * 
 * Body:
 *   productId: string - ID of the product to reserve
 *   warehouseId: string - ID of the warehouse
 *   quantity: number - Number of units to reserve (must be > 0)
 * 
 * Status Codes:
 *   201: Reservation created successfully
 *   409: Insufficient stock available
 *   404: Product or warehouse combination not found
 * 
 * Race Condition Safety:
 *   - Uses database transactions with row-level locking (SELECT ... FOR UPDATE)
 *   - Ensures exact one reservation succeeds if two simultaneous requests try to reserve the last item
 */
export async function POST(request: NextRequest) {
  try {
    // Get optional idempotency key from headers
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? undefined;

    // Parse and validate request body
    const body = await request.json();
    const validated = CreateReservationSchema.parse(body);

    // Create reservation with race-condition safety
    const result = await createReservationSafe(
      validated.productId,
      validated.warehouseId,
      validated.quantity,
      idempotencyKey
    );

    if (!result.success) {
      const conflictCode = result.conflictCode;

      if (conflictCode === 'INSUFFICIENT_STOCK') {
        return conflictResponse(
          ERROR_CODES.INSUFFICIENT_STOCK,
          'Insufficient stock available for this reservation. Another customer may have reserved the same items.'
        );
      }

      if (conflictCode === 'INVENTORY_NOT_FOUND') {
        return notFoundResponse(
          ERROR_CODES.INVALID_PRODUCT,
          'Product or warehouse combination not found'
        );
      }
    }

    // Calculate expiry time in milliseconds
    const expiresAt = new Date(result.data!.expiresAt);
    const expiresIn = expiresAt.getTime() - Date.now();

    return createdResponse({
      reservation: result.data,
      expiresIn,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(new Error('Validation error'));
    }

    return handleApiError(error);
  }
}

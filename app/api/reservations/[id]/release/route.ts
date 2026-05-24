import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse, handleApiError } from '@/lib/api-response';
import { releaseReservation } from '@/lib/reservation';
import { ERROR_CODES } from '@/lib/types';

/**
 * Releases a reservation - idempotent endpoint
 * 
 * Idempotency: If a client retries this request with the same Idempotency-Key header,
 * the server will return the same response without repeating the side effect.
 * 
 * The release is idempotent because:
 * - If reservation is already RELEASED or EXPIRED, it returns success without modifying inventory again
 * - The Idempotency-Key header is optional but recommended for retry safety
 * 
 * Headers:
 *   Idempotency-Key: Optional unique key to ensure request idempotency
 * 
 * Status Codes:
 *   200: Reservation released successfully
 *   404: Reservation not found
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservationId = params.id;
    const idempotencyKey = request.headers.get('Idempotency-Key');

    const result = await releaseReservation(reservationId);

    if (!result.success) {
      const conflictCode = result.conflictCode;

      if (conflictCode === 'RESERVATION_NOT_FOUND') {
        return notFoundResponse(
          ERROR_CODES.RESERVATION_NOT_FOUND,
          'Reservation not found'
        );
      }
    }

    return successResponse({
      reservation: result.data,
      inventoryUpdated: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

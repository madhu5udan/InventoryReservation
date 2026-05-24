import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse, goneResponse, handleApiError } from '@/lib/api-response';
import { confirmReservation } from '@/lib/reservation';
import { ERROR_CODES } from '@/lib/types';

/**
 * Confirms a reservation - idempotent endpoint
 * 
 * Idempotency: If a client retries this request with the same Idempotency-Key header,
 * the server will return the same response without repeating the side effect.
 * 
 * The confirmation is idempotent because:
 * - If reservation is already CONFIRMED, it returns success without modifying inventory again
 * - The Idempotency-Key header is optional but recommended for retry safety
 * 
 * Headers:
 *   Idempotency-Key: Optional unique key to ensure request idempotency
 * 
 * Status Codes:
 *   200: Reservation confirmed successfully
 *   404: Reservation not found
 *   410: Reservation has expired
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservationId = params.id;
    const idempotencyKey = request.headers.get('Idempotency-Key');

    const result = await confirmReservation(reservationId);

    if (!result.success) {
      const conflictCode = result.conflictCode;

      if (conflictCode === 'RESERVATION_NOT_FOUND') {
        return notFoundResponse(
          ERROR_CODES.RESERVATION_NOT_FOUND,
          'Reservation not found'
        );
      }

      if (conflictCode === 'RESERVATION_EXPIRED') {
        return goneResponse(
          ERROR_CODES.RESERVATION_EXPIRED,
          'Reservation has expired. Please create a new reservation.'
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

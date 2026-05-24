import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { successResponse, notFoundResponse, handleApiError } from '@/lib/api-response';
import { ERROR_CODES } from '@/lib/types';
import { handleExpiredReservations } from '@/lib/reservation';

const prisma = new PrismaClient();

/**
 * Get a reservation by ID
 * 
 * If the reservation is PENDING and has expired (expiresAt < now),
 * it will automatically be marked as EXPIRED and stock will be released.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservationId = params.id;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!reservation) {
      return notFoundResponse(
        ERROR_CODES.RESERVATION_NOT_FOUND,
        'Reservation not found'
      );
    }

    // Check if this PENDING reservation has expired
    if (reservation.status === 'PENDING' && new Date() > reservation.expiresAt) {
      // Automatically expire this reservation and release stock
      await handleExpiredReservations();
      
      // Fetch updated reservation
      const updated = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          product: true,
          warehouse: true,
        },
      });
      
      return successResponse(updated);
    }

    return successResponse(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}

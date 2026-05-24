import { PrismaClient } from '@prisma/client';
import { ReservationData } from './types';

const prisma = new PrismaClient();

/**
 * Creates a reservation with race-condition safety using:
 * 1. Database transaction
 * 2. Row-level locking (SELECT ... FOR UPDATE)
 * 3. Atomic stock validation and update
 *
 * This ensures that if two simultaneous requests try to reserve the last item,
 * exactly one will succeed and the other will receive a 409 Conflict.
 */
export async function createReservationSafe(
  productId: string,
  warehouseId: string,
  quantity: number,
  idempotencyKey?: string
): Promise<{ success: boolean; data?: ReservationData; conflictCode?: string }> {
  try {
    // Check for idempotency - if this key was already processed, return cached result
    if (idempotencyKey) {
      const existingReservation = await prisma.reservation.findUnique({
        where: { idempotencyKey },
      });

      if (existingReservation) {
        return {
          success: true,
          data: existingReservation as ReservationData,
        };
      }
    }

    // Use transaction with row-level locking for race-condition safety
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Lock inventory row exclusively
      // SELECT ... FOR UPDATE at the SQL level prevents concurrent modifications
      const inventory = await tx.$queryRaw<
        Array<{ id: string; totalStock: number; reservedStock: number }>
      >`
        SELECT id, "totalStock", "reservedStock" 
        FROM "Inventory" 
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (inventory.length === 0) {
        throw new Error('INVENTORY_NOT_FOUND');
      }

      const inv = inventory[0];

      // Step 2: Calculate available stock
      const availableStock = inv.totalStock - inv.reservedStock;

      // Step 3: Check if sufficient stock available
      if (availableStock < quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Step 4: Update reserved stock atomically (still within transaction + lock)
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET "reservedStock" = "reservedStock" + ${quantity},
            "updatedAt" = NOW()
        WHERE id = ${inv.id}
      `;

      // Step 5: Create reservation with expiry time (10 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          expiresAt,
          idempotencyKey,
          status: 'PENDING',
        },
      });

      return reservation;
    });

    return {
      success: true,
      data: result as ReservationData,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INSUFFICIENT_STOCK') {
        return {
          success: false,
          conflictCode: 'INSUFFICIENT_STOCK',
        };
      }
      if (error.message === 'INVENTORY_NOT_FOUND') {
        return {
          success: false,
          conflictCode: 'INVENTORY_NOT_FOUND',
        };
      }
    }

    throw error;
  }
}

/**
 * Confirms a reservation and permanently reduces stock
 * Idempotent: safe to call multiple times for the same reservation
 */
export async function confirmReservation(reservationId: string): Promise<{
  success: boolean;
  data?: ReservationData;
  conflictCode?: string;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock reservation row
      const reservations = await tx.$queryRaw<
        Array<{
          id: string;
          productId: string;
          warehouseId: string;
          quantity: number;
          status: string;
          expiresAt: Date;
        }>
      >`
        SELECT id, "productId", "warehouseId", quantity, status, "expiresAt"
        FROM "Reservation"
        WHERE id = ${reservationId}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        throw new Error('RESERVATION_NOT_FOUND');
      }

      const reservation = reservations[0];

      // Check if reservation expired
      if (new Date() > reservation.expiresAt) {
        throw new Error('RESERVATION_EXPIRED');
      }

      // If already confirmed, return success (idempotent)
      if (reservation.status === 'CONFIRMED') {
        return reservation;
      }

      // Lock inventory row
      const inventories = await tx.$queryRaw<
        Array<{ id: string; totalStock: number; reservedStock: number }>
      >`
        SELECT id, "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${reservation.productId} 
          AND "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        throw new Error('INVENTORY_NOT_FOUND');
      }

      const inv = inventories[0];

      // Decrement both totalStock and reservedStock
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET "totalStock" = "totalStock" - ${reservation.quantity},
            "reservedStock" = "reservedStock" - ${reservation.quantity},
            "updatedAt" = NOW()
        WHERE id = ${inv.id}
      `;

      // Update reservation status to CONFIRMED
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CONFIRMED',
          updatedAt: new Date(),
        },
      });

      return updated;
    });

    return {
      success: true,
      data: result as ReservationData,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RESERVATION_EXPIRED') {
        return {
          success: false,
          conflictCode: 'RESERVATION_EXPIRED',
        };
      }
      if (error.message === 'RESERVATION_NOT_FOUND') {
        return {
          success: false,
          conflictCode: 'RESERVATION_NOT_FOUND',
        };
      }
    }

    throw error;
  }
}

/**
 * Releases a reservation and returns stock to available pool
 * Idempotent: safe to call multiple times
 */
export async function releaseReservation(reservationId: string): Promise<{
  success: boolean;
  data?: ReservationData;
  conflictCode?: string;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock reservation row
      const reservations = await tx.$queryRaw<
        Array<{
          id: string;
          productId: string;
          warehouseId: string;
          quantity: number;
          status: string;
        }>
      >`
        SELECT id, "productId", "warehouseId", quantity, status
        FROM "Reservation"
        WHERE id = ${reservationId}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        throw new Error('RESERVATION_NOT_FOUND');
      }

      const reservation = reservations[0];

      // If already released, return success (idempotent)
      if (reservation.status === 'RELEASED' || reservation.status === 'EXPIRED') {
        return reservation;
      }

      // Lock inventory row
      const inventories = await tx.$queryRaw<
        Array<{ id: string; reservedStock: number }>
      >`
        SELECT id, "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        throw new Error('INVENTORY_NOT_FOUND');
      }

      const inv = inventories[0];

      // Decrement reservedStock
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET "reservedStock" = "reservedStock" - ${reservation.quantity},
            "updatedAt" = NOW()
        WHERE id = ${inv.id}
      `;

      // Update reservation status to RELEASED
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'RELEASED',
          updatedAt: new Date(),
        },
      });

      return updated;
    });

    return {
      success: true,
      data: result as ReservationData,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RESERVATION_NOT_FOUND') {
        return {
          success: false,
          conflictCode: 'RESERVATION_NOT_FOUND',
        };
      }
    }

    throw error;
  }
}

/**
 * Finds and marks expired reservations as EXPIRED
 * Decrements reservedStock for expired reservations
 */
export async function handleExpiredReservations(): Promise<number> {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Find all expired PENDING reservations
    const expiredReservations = await tx.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
    });

    // Update each expired reservation and decrement inventory
    for (const reservation of expiredReservations) {
      // Lock inventory row
      const inventories = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT id FROM "Inventory"
        WHERE "productId" = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length > 0) {
        // Decrement reservedStock
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "reservedStock" = "reservedStock" - ${reservation.quantity},
              "updatedAt" = NOW()
          WHERE id = ${inventories[0].id}
        `;
      }

      // Mark reservation as EXPIRED
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });
    }

    return expiredReservations.length;
  });

  return result;
}

/**
 * Gets reservation with full details
 */
export async function getReservation(reservationId: string): Promise<ReservationData | null> {
  return (await prisma.reservation.findUnique({
    where: { id: reservationId },
  })) as ReservationData | null;
}

/**
 * Gets inventory with calculated available stock
 */
export async function getInventory(productId: string, warehouseId: string) {
  return prisma.inventory.findUnique({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId,
      },
    },
  });
}

import { prisma } from "./prisma";

export async function cleanupExpiredReservations() {
  await prisma.$transaction(async (tx) => {
    const expiredReservations =
      await tx.reservation.findMany({
        where: {
          status: "PENDING",
          expiresAt: {
            lt: new Date(),
          },
        },
      });

    for (const reservation of expiredReservations) {
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      });

      await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: "EXPIRED",
        },
      });
    }
  });
}
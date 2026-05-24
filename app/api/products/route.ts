import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { successResponse, handleApiError } from '@/lib/api-response';
import { cleanupExpiredReservations }
from "@/lib/cleanupExpiredReservations";

const prisma = new PrismaClient();
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await cleanupExpiredReservations();
  try {
    const products = await prisma.product.findMany({
      include: {
        inventories: {
          select: {
            warehouseId: true,
            totalStock: true,
            reservedStock: true,
          },
        },
      },
    });

    // Transform to include availableStock
    const productsWithAvailable = products.map((product) => ({
      ...product,
      inventories: product.inventories.map((inv) => ({
        ...inv,
        availableStock: inv.totalStock - inv.reservedStock,
      })),
    }));

    return successResponse(productsWithAvailable);
  } catch (error) {
    return handleApiError(error);
  }
}

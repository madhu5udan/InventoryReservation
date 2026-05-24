import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { successResponse, handleApiError } from '@/lib/api-response';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return successResponse(warehouses);
  } catch (error) {
    return handleApiError(error);
  }
}

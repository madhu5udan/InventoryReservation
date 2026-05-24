import { ReservationStatus } from '@prisma/client';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Product Types
export interface ProductWithInventory {
  id: string;
  name: string;
  sku: string;
  createdAt: Date;
  inventories: {
    warehouseId: string;
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  }[];
}

// Warehouse Types
export interface WarehouseData {
  id: string;
  name: string;
  location: string;
  createdAt: Date;
}

// Inventory Types
export interface InventoryData {
  id: string;
  productId: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  updatedAt: Date;
}

// Reservation Types
export interface ReservationData {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response for Reservation
export interface CreateReservationRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export interface CreateReservationResponse {
  reservation: ReservationData;
  expiresIn: number; // milliseconds
}

export interface ConfirmReservationResponse {
  reservation: ReservationData;
  inventoryUpdated: boolean;
}

export interface ReleaseReservationResponse {
  reservation: ReservationData;
  inventoryUpdated: boolean;
}

// Error Codes
export const ERROR_CODES = {
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  RESERVATION_ALREADY_CONFIRMED: 'RESERVATION_ALREADY_CONFIRMED',
  INVALID_PRODUCT: 'INVALID_PRODUCT',
  INVALID_WAREHOUSE: 'INVALID_WAREHOUSE',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
};

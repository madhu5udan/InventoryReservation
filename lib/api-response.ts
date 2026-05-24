import { NextResponse } from 'next/server';
import { ApiResponse, ERROR_CODES } from './types';

export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

export function conflictResponse(code: string, message: string): NextResponse<ApiResponse<null>> {
  return errorResponse(code, message, 409);
}

export function notFoundResponse(code: string, message: string): NextResponse<ApiResponse<null>> {
  return errorResponse(code, message, 404);
}

export function goneResponse(code: string, message: string): NextResponse<ApiResponse<null>> {
  return errorResponse(code, message, 410);
}

export function createdResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return successResponse(data, 201);
}

// Error handler for API routes
export async function handleApiError(error: unknown): Promise<NextResponse<ApiResponse<null>>> {
  console.error('API Error:', error);

  if (error instanceof Error) {
    if (error.message === 'Validation error') {
      return errorResponse(
        ERROR_CODES.INVALID_QUANTITY,
        error.message,
        422
      );
    }
  }

  return errorResponse(
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    'An unexpected error occurred',
    500
  );
}

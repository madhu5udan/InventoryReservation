import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-response';
import { handleExpiredReservations } from '@/lib/reservation';

/**
 * Cron endpoint to handle expired reservations
 * This should be called periodically (e.g., every 5 minutes) to clean up expired reservations
 * 
 * On Vercel:
 * - Cron jobs are configured in vercel.json
 * - Vercel automatically adds Authorization header: Bearer <CRON_SECRET>
 * - Set CRON_SECRET in environment variables for additional security
 * 
 * Alternative deployment:
 * - External service like EasyCron or AWS EventBridge
 * - Database trigger with background job
 * 
 * Vercel cron config in vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/expire-reservations",
 *       "schedule": "*/5 * * * *"
 *     }
 *   ]
 * }
 */

export async function POST(request: NextRequest) {
  try {
    // Validate using Vercel's built-in cron security header
    // Vercel adds an Authorization header: Bearer <cron_secret>
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In development, allow without secret validation
    // In production, validate if secret is set
    const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === 'true';
    
    if (isProduction && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('UNAUTHORIZED', 'Invalid cron secret', 401);
    }

    console.log('🔄 [CRON] Processing expired reservations...');
    const expiredCount = await handleExpiredReservations();

    return successResponse({
      message: 'Expired reservations processed',
      expiredReservationsCount: expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Manual trigger for development - GET /api/cron/expire-reservations
 * In development, allows immediate manual expiry of reservations without waiting for scheduled cron.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === 'true';
    
    if (isProduction && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('UNAUTHORIZED', 'Invalid cron secret', 401);
    }

    console.log('🔄 [MANUAL CRON - GET] Processing expired reservations...');
    const expiredCount = await handleExpiredReservations();

    return successResponse({
      message: 'Expired reservations processed',
      expiredReservationsCount: expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

# Inventory Reservation System

A modern inventory management system built with Next.js that handles product reservations across multiple warehouses with race-condition safety and automatic expiry management.

## Table of Contents

- [Running the App Locally](#running-the-app-locally)
- [How the Expiry Mechanism Works in Production](#how-the-expiry-mechanism-works-in-production)
- [Architecture & Trade-offs](#architecture--trade-offs)

## Running the App Locally

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+ (local or cloud instance)
- npm or yarn package manager

### Environment Setup

1. **Clone the repository and install dependencies:**

```bash
npm install
```

2. **Create a `.env.local` file** in the project root with the following variables:

```env
# Database Connection
DATABASE_URL="postgresql://username:password@localhost:5432/inventory_reservation"

# Optional: Vercel specific (only needed for Vercel deployments)
VERCEL_ENV=development
```

**Note:** For PostgreSQL, you can use:
- Local installation: `postgresql://postgres:password@localhost:5432/inventory_reservation`
- Docker: `postgresql://postgres:password@postgres:5432/inventory_reservation`
- Cloud services: Supabase, Railway, or any managed PostgreSQL provider

### Database Setup

1. **Run Prisma migrations** to create the database schema:

```bash
npx prisma migrate dev --name init
```

This command will:
- Create the PostgreSQL database if it doesn't exist
- Run all migrations in `prisma/migrations/`
- Generate Prisma Client

2. **Seed the database** with sample data:

```bash
npm run seed
# or manually run
npx prisma db seed
```

The seed script creates:
- **3 Warehouses:** Los Angeles Hub, New York Hub, Chicago Hub
- **5 Products:** Wireless Headphones, USB-C Cable, Phone Case, Screen Protector, Portable Charger
- **15 Inventory records:** Each product stocked in each warehouse with realistic quantities

### Running the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

**Available endpoints:**
- `GET /api/products` - List all products with inventory across warehouses
- `GET /api/warehouses` - List all warehouses
- `POST /api/reservations` - Create a new reservation
- `GET /api/reservations` - List pending reservations (triggers cleanup)
- `POST /api/reservations/[id]/confirm` - Confirm a reservation
- `POST /api/reservations/[id]/release` - Release a reservation

### Other Development Commands

```bash
# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Open Prisma Studio (visual database browser)
npx prisma studio
```

## How the Expiry Mechanism Works in Production

### Overview

The system automatically expires uncompleted reservations after **10 minutes** using a **lazy cleanup strategy** with database transactions. This approach eliminates the need for scheduled background jobs (cron), which are not available on Vercel's free tier.

### The Lazy Cleanup Pattern

Instead of running a periodic cron job, expired reservations are cleaned up **on-demand** whenever a user interacts with the reservation system:

1. **When a user retrieves pending reservations** (`GET /api/reservations`):
   - The system checks for any expired PENDING reservations
   - Atomically updates expired reservations and restores reserved inventory
   - Returns only valid, non-expired reservations to the user

```typescript
// In GET /api/reservations
await handleExpiredReservations(); // Cleanup happens here
const pendingReservations = await prisma.reservation.findMany({
  where: {
    status: 'PENDING',
    expiresAt: { gt: new Date() } // Only non-expired
  }
});
```

### Transactional Consistency

The cleanup process uses **Prisma transactions** with **row-level database locking** to ensure data consistency:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Find all expired PENDING reservations
  const expiredReservations = await tx.reservation.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } }
  });

  // 2. For each expired reservation
  for (const reservation of expiredReservations) {
    // Lock inventory row (prevents concurrent modifications)
    const inventory = await tx.$queryRaw`
      SELECT id FROM "Inventory"
      WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
      FOR UPDATE
    `;

    // 3. Restore reserved stock back to available inventory
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = "reservedStock" - ${reservation.quantity}
      WHERE id = ${inventory.id}
    `;

    // 4. Mark reservation as EXPIRED
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: 'EXPIRED' }
    });
  }
});
```

### Why Vercel Free Tier Limitation

Vercel's free tier does not provide background workers or scheduled cron jobs. The lazy cleanup approach solves this by:
- ✅ Requiring no external services or scheduled jobs
- ✅ Keeping cleanup logic close to data access patterns
- ✅ Scaling automatically with user traffic
- ✅ Ensuring transactional atomicity

### Reservation Lifecycle

```
PENDING (10 min timeout) ──expiry──> EXPIRED (cleanup updates inventory)
   ↓
   └──confirm──> CONFIRMED (final)
   └──release──> RELEASED (restores inventory immediately)
```

**Key states:**
- `PENDING`: Initial reservation state, locked for 10 minutes
- `CONFIRMED`: User completed checkout, stock is permanently consumed
- `RELEASED`: User cancelled reservation, stock returned immediately
- `EXPIRED`: Automatic cleanup after 10-minute timeout, stock returned

## Architecture & Trade-offs

### Race Condition Safety

The system prevents double-booking using **database-level locks with transactions**:

```typescript
// SELECT ... FOR UPDATE (row-level lock)
const inventory = await tx.$queryRaw`
  SELECT id, "totalStock", "reservedStock"
  FROM "Inventory"
  WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
  FOR UPDATE
`;
```

This ensures that if two simultaneous requests attempt to reserve the last item:
- Request A locks the inventory row
- Request B waits for the lock
- Request A validates stock and succeeds
- Request B wakes up, validates stock (now insufficient), and fails with 409 Conflict

### Idempotency

All reservation creation requests are **idempotent** using idempotency keys:
- Client provides an `Idempotency-Key` header (e.g., UUID)
- Database has a unique constraint on `idempotencyKey`
- If a request is retried with the same key, the original result is returned
- Duplicate reservations are prevented automatically

### 10-Minute Expiry Window

**Why 10 minutes?**
- Long enough for users to complete checkout
- Short enough to minimize held inventory
- Balances user experience with inventory availability

**Trade-off:** 
- Shorter window = faster inventory release but worse UX if checkout takes time
- Longer window = better UX but inventory tied up longer

### Lazy Cleanup Trade-offs

**Advantages:**
- ✅ No infrastructure needed (no cron service/scheduler)
- ✅ Scales naturally with request volume
- ✅ Transactional consistency guaranteed
- ✅ Works on Vercel free tier

**Disadvantages:**
- ⚠️ Cleanup only happens when someone fetches reservations
- ⚠️ If no one uses the system for hours, expired reservations stay in DB (but marked EXPIRED)
- ⚠️ First request after expiry has slight latency hit from cleanup

## What We'd Do Differently With More Time

### 1. **Scheduled Cleanup Job**
   - Move to a platform with background job support (Railway, Render, self-hosted)
   - Implement true cron-based cleanup instead of lazy cleanup
   - Pros: Predictable cleanup timing, no request latency hit
   - Cons: Requires paid tier or external service

### 2. **Configurable Expiry Window**
   - Store expiry duration in database or config
   - Allow different expiry times per product
   - Implement sliding-window expiry (extend on cart interaction)

### 3. **Inventory Reservations Analytics**
   - Track reservation success rates
   - Monitor expired vs. confirmed reservations
   - Identify popular products and peak traffic times
   - Enable data-driven inventory decisions

### 4. **Advanced Reservation Features**
   - **Partial fulfillment:** Accept partial quantities if full amount unavailable
   - **Backorder support:** Hold orders beyond 10 minutes if user opts in
   - **Reserved stock visibility:** Show customers how many items are reserved
   - **Reservation extensions:** Allow users to extend expiry if checking out slowly

### 5. **Performance Optimizations**
   - **Batch cleanup:** Process multiple expired reservations in single query
   - **Pagination for reservations:** Handle millions of reservations efficiently
   - **Database indexing:** Add index on `status + expiresAt` for faster queries
   - **Caching layer:** Cache inventory across warehouses temporarily

### 6. **Observability & Monitoring**
   - **Logging:** Track all state transitions (reservation created, expired, confirmed)
   - **Metrics:** Monitor cleanup duration, failed updates, race conditions
   - **Alerting:** Alert if expiry cleanup starts taking too long
   - **Audit trail:** Maintain complete history of inventory changes

### 7. **Testing**
   - **Concurrency tests:** Verify race condition handling under load
   - **Expiry tests:** Automated tests for cleanup logic
   - **Integration tests:** End-to-end reservation workflow tests
   - **Load tests:** Verify system behavior with thousands of concurrent reservations

### 8. **Database Optimizations**
   - **Partition Reservation table** by date for better scaling
   - **Archive expired reservations** after 30 days
   - **Connection pooling** for better performance under load
   - **Read replicas** for analytics queries (separate from transactional writes)

## Database Schema

```
Product
├── id (CUID, Primary Key)
├── name (Unique)
├── sku (Unique, Indexed)
└── Relationships: Inventory[], Reservation[]

Warehouse
├── id (CUID, Primary Key)
├── name (Unique, Indexed)
├── location
└── Relationships: Inventory[], Reservation[]

Inventory
├── id (CUID, Primary Key)
├── productId (Foreign Key)
├── warehouseId (Foreign Key)
├── totalStock (Default: 0)
├── reservedStock (Default: 0)
├── Unique Constraint: [productId, warehouseId]
└── Relationships: Product, Warehouse

Reservation
├── id (CUID, Primary Key)
├── productId (Foreign Key, Indexed)
├── warehouseId (Foreign Key, Indexed)
├── quantity
├── status (PENDING, CONFIRMED, RELEASED, EXPIRED - Indexed)
├── expiresAt (DateTime, Indexed)
├── idempotencyKey (Unique, Optional)
└── Relationships: Product, Warehouse
```

## Tech Stack

- **Framework:** Next.js 14
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **UI:** React 18 with shadcn/ui
- **Validation:** Zod
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios

## License

MIT

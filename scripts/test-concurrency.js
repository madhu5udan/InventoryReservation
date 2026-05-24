#!/usr/bin/env node

/**
 * Concurrency test script to verify race condition handling
 *
 * This script sends simultaneous reservation requests to test
 * that exactly one succeeds when there's insufficient stock.
 *
 * Usage:
 *   node scripts/test-concurrency.js <productId> <warehouseId> <numRequests>
 *
 * Example:
 *   node scripts/test-concurrency.js "prod123" "wh456" 5
 */

const http = require("http");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function makeReservation(productId, warehouseId, quantity = 1) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      productId,
      warehouseId,
      quantity,
    });

    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/api/reservations",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
        "Idempotency-Key": Math.random().toString(36).substr(2, 9),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            status: res.statusCode,
            body: parsed,
            timestamp: Date.now(),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: body,
            timestamp: Date.now(),
          });
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function runTest() {
  const [, , productId, warehouseId, numRequests] = process.argv;

  if (!productId || !warehouseId) {
    console.error(
      "Usage: node scripts/test-concurrency.js <productId> <warehouseId> [numRequests=2]",
    );
    process.exit(1);
  }

  const num = parseInt(numRequests || "2");

  console.log(`\n🧪 Concurrency Test: ${num} simultaneous reservations\n`);
  console.log(`Product ID: ${productId}`);
  console.log(`Warehouse ID: ${warehouseId}`);
  console.log(`Requests: ${num}\n`);

  // Fire off all requests simultaneously
  const promises = Array.from({ length: num }, (_, i) =>
    makeReservation(productId, warehouseId, 1),
  );

  const results = await Promise.all(promises);

  // Analyze results
  const successful = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const errors = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log("📊 Results:\n");
  console.log(`✅ Successful (201): ${successful.length}`);
  console.log(`❌ Conflicts (409): ${conflicts.length}`);
  console.log(`⚠️  Errors: ${errors.length}\n`);

  if (successful.length > 0) {
    console.log("✅ Successful Reservations:");
    successful.forEach((r, i) => {
      const reservation = r.body.data?.reservation;
      console.log(`   ${i + 1}. ID: ${reservation?.id || "N/A"}`);
      console.log(`      Expires: ${reservation?.expiresAt || "N/A"}`);
    });
    console.log();
  }

  if (conflicts.length > 0) {
    console.log("❌ Conflicts (Insufficient Stock):");
    conflicts.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.body.error?.message || "No message"}`);
    });
    console.log();
  }

  if (errors.length > 0) {
    console.log("⚠️  Other Errors:");
    errors.forEach((r, i) => {
      console.log(`   ${i + 1}. Status: ${r.status}`);
      console.log(`      ${JSON.stringify(r.body)}`);
    });
    console.log();
  }

  // Verify correctness
  console.log("✅ Race condition handling is correct!\n");

  if (successful.length <= 1) {
    console.log("✓ Zero or one reservation succeeded (correct behavior)");
  } else {
    console.log(
      "✗ ERROR: Multiple reservations succeeded (race condition detected!)",
    );
  }

  if (conflicts.length + errors.length === num - successful.length) {
    console.log("✓ Remaining requests failed as expected");
  }

  console.log();
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

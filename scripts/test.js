const http = require("http");

async function makeRequest(productId, warehouseId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      productId,
      warehouseId,
      quantity: 1,
    });

    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path: "/api/reservations",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body,
          });
        });
      },
    );

    req.on("error", reject);

    req.write(payload);
    req.end();
  });
}

async function main() {
  const productId = process.argv[2];
  const warehouseId = process.argv[3];

  if (!productId || !warehouseId) {
    console.log(
      "Usage: node scripts/test-concurrency.js PRODUCT_ID WAREHOUSE_ID",
    );
    process.exit(1);
  }

  console.log("\n🧪 Running Concurrency Test...\n");

  const requests = Array.from({ length: 20 }, () =>
    makeRequest(productId, warehouseId),
  );

  const results = await Promise.all(requests);

  const success = results.filter((r) => r.status === 201);

  const conflicts = results.filter((r) => r.status === 409);

  const errors = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log("===== RESULTS =====\n");

  console.log(`✅ Successful Reservations: ${success.length}`);

  console.log(`❌ Conflicts (409): ${conflicts.length}`);

  console.log(`⚠️ Other Errors: ${errors.length}\n`);

  if (success.length === 1) {
    console.log("✅ CONCURRENCY HANDLED CORRECTLY");

    console.log("Exactly one reservation succeeded.");
  } else {
    console.log("❌ RACE CONDITION DETECTED");

    console.log("Multiple reservations succeeded.");
  }

  console.log();
}

main().catch(console.error);

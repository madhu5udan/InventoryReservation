const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Los Angeles Hub",
        location: "Los Angeles, CA",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "New York Hub",
        location: "New York, NY",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Chicago Hub",
        location: "Chicago, IL",
      },
    }),
  ]);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Headphones",
        sku: "WHP-001",
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Cable",
        sku: "USB-002",
      },
    }),
    prisma.product.create({
      data: {
        name: "Phone Case",
        sku: "CASE-003",
      },
    }),
    prisma.product.create({
      data: {
        name: "Screen Protector",
        sku: "SCREEN-004",
      },
    }),
    prisma.product.create({
      data: {
        name: "Portable Charger",
        sku: "CHARGE-005",
      },
    }),
  ]);

  // Create inventory for each product in each warehouse
  const inventoryData = [
    // Product 1: Wireless Headphones
    {
      productId: products[0].id,
      warehouseId: warehouses[0].id,
      totalStock: 50,
    },
    {
      productId: products[0].id,
      warehouseId: warehouses[1].id,
      totalStock: 30,
    },
    {
      productId: products[0].id,
      warehouseId: warehouses[2].id,
      totalStock: 25,
    },
    // Product 2: USB-C Cable
    {
      productId: products[1].id,
      warehouseId: warehouses[0].id,
      totalStock: 200,
    },
    {
      productId: products[1].id,
      warehouseId: warehouses[1].id,
      totalStock: 150,
    },
    {
      productId: products[1].id,
      warehouseId: warehouses[2].id,
      totalStock: 100,
    },
    // Product 3: Phone Case
    {
      productId: products[2].id,
      warehouseId: warehouses[0].id,
      totalStock: 75,
    },
    {
      productId: products[2].id,
      warehouseId: warehouses[1].id,
      totalStock: 60,
    },
    {
      productId: products[2].id,
      warehouseId: warehouses[2].id,
      totalStock: 80,
    },
    // Product 4: Screen Protector
    {
      productId: products[3].id,
      warehouseId: warehouses[0].id,
      totalStock: 100,
    },
    {
      productId: products[3].id,
      warehouseId: warehouses[1].id,
      totalStock: 90,
    },
    {
      productId: products[3].id,
      warehouseId: warehouses[2].id,
      totalStock: 110,
    },
    // Product 5: Portable Charger
    {
      productId: products[4].id,
      warehouseId: warehouses[0].id,
      totalStock: 40,
    },
    {
      productId: products[4].id,
      warehouseId: warehouses[1].id,
      totalStock: 35,
    },
    {
      productId: products[4].id,
      warehouseId: warehouses[2].id,
      totalStock: 45,
    },
  ];

  await Promise.all(
    inventoryData.map((data) =>
      prisma.inventory.create({
        data: {
          ...data,
          reservedStock: 0,
        },
      }),
    ),
  );

  console.log("Seed data created successfully!");
  console.log("Warehouses:", warehouses.length);
  console.log("Products:", products.length);
  console.log("Inventory records:", inventoryData.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

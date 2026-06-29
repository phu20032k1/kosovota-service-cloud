import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const [users, machines, dealers, customers] = await Promise.all([
    prisma.user.count(),
    prisma.machine.count(),
    prisma.dealer.count(),
    prisma.customer.count(),
  ]);
  console.log("OK: Kết nối Neon/PostgreSQL thành công.");
  console.log(`Thời gian phản hồi: ${Date.now() - started} ms`);
  console.log(`Users=${users}, Machines=${machines}, Dealers=${dealers}, Customers=${customers}`);
}

main()
  .catch((error) => {
    console.error("LỖI: Không kết nối được database.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import { seedPassages } from "../src/lib/seed-passages";

const prisma = new PrismaClient();

async function main() {
  const seededIds = await seedPassages(prisma);
  for (const id of seededIds) {
    console.log(`Seeded passage #${id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

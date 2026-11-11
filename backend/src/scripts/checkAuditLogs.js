import "dotenv/config";
import prisma from "../config/prisma.js";

async function main() {
  const logs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    select: {
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });

  console.log("AUDIT LOGS:");
  console.log(JSON.stringify(logs, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
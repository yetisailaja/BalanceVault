
import "dotenv/config";
import prisma from "../config/prisma.js";

async function main() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      ledgerEntries: {
        select: {
          direction: true,
          amountPaise: true,
          accountId: true,
        },
      },
    },
  });

  for (const tx of transactions) {
    const debit = tx.ledgerEntries
      .filter((entry) => entry.direction === "DEBIT")
      .reduce((sum, entry) => sum + entry.amountPaise, 0n);

    const credit = tx.ledgerEntries
      .filter((entry) => entry.direction === "CREDIT")
      .reduce((sum, entry) => sum + entry.amountPaise, 0n);

    const balanced =
      debit === credit &&
      tx.ledgerEntries.length === 2;

    console.log({
      transactionId: tx.id,
      type: tx.type,
      amountPaise: tx.amountPaise.toString(),
      debitPaise: debit.toString(),
      creditPaise: credit.toString(),
      ledgerEntries: tx.ledgerEntries.length,
      balanced,
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

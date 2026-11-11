
import prisma from "../config/prisma.js";

export const getMyAccount = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        onboardingRequest: true,
        accounts: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active",
      });
    }

    if (user.onboardingRequest?.status !== "APPROVED") {
      return res.status(403).json({
        message: "Your onboarding must be approved first",
      });
    }

    const accounts = user.accounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      currency: account.currency,
      status: account.status,
      balancePaise: account.balancePaise.toString(),
      balanceRupees: (Number(account.balancePaise) / 100).toFixed(2),
    }));

    return res.status(200).json({
      message: "Account retrieved successfully",
      accounts,
    });
  } catch (error) {
    console.error("Get account error:", error);

    return res.status(500).json({
      message: "Could not retrieve account",
    });
  }
};

export const getMyTransactions = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        onboardingRequest: true,
        accounts: { select: { id: true }, where: { type: "CUSTOMER" } },
      },
    });

    if (!user || user.status !== "ACTIVE" || user.onboardingRequest?.status !== "APPROVED") {
      return res.status(403).json({ message: "Your approved customer account is required" });
    }

    const accountIds = user.accounts.map((account) => account.id);
    const rows = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: { in: accountIds } },
          { toAccountId: { in: accountIds } },
        ],
      },
      include: {
        fromAccount: { select: { accountNumber: true } },
        toAccount: { select: { accountNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const transactions = rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      amountPaise: row.amountPaise.toString(),
      amountRupees: (Number(row.amountPaise) / 100).toFixed(2),
      description: row.description,
      fromAccountNumber: row.fromAccount?.accountNumber || null,
      toAccountNumber: row.toAccount?.accountNumber || null,
      direction: accountIds.includes(row.fromAccountId) ? "DEBIT" : "CREDIT",
      createdAt: row.createdAt,
    }));

    return res.json({ message: "Transactions retrieved successfully", transactions });
  } catch (error) {
    console.error("Transaction history error:", error);
    return res.status(500).json({ message: "Could not retrieve transaction history" });
  }
};

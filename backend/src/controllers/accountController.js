
import { z } from "zod";
import prisma from "../config/prisma.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const getMyAccount = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        onboardingRequest: true,
        accounts: {
          where: { status: "ACTIVE", type: "CUSTOMER" },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active",
      });
    }

    if (
      user.role !== "ACCOUNT_HOLDER" ||
      user.onboardingRequest?.status !== "APPROVED"
    ) {
      return res.status(403).json({
        message: "Your approved account-holder access is required",
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
    const parsed = paginationSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid pagination parameters",
        errors: parsed.error.flatten(),
      });
    }

    const { page, limit } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        status: true,
        onboardingRequest: {
          select: { status: true },
        },
        accounts: {
          where: { type: "CUSTOMER" },
          select: {
            id: true,
            accountNumber: true,
            currency: true,
            balancePaise: true,
          },
        },
      },
    });

    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.role !== "ACCOUNT_HOLDER" ||
      user.onboardingRequest?.status !== "APPROVED"
    ) {
      return res.status(403).json({
        message: "Your approved account-holder access is required",
      });
    }

    const accountIds = user.accounts.map((account) => account.id);

    if (accountIds.length === 0) {
      return res.status(200).json({
        message: "Statement retrieved successfully",
        accounts: [],
        transactions: [],
        refusedAttempts: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Retrieve ledger entries only for accounts owned by this user.
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        accountId: { in: accountIds },
      },
      include: {
        transaction: {
          include: {
            initiatedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
            fromAccount: {
              select: { accountNumber: true },
            },
            toAccount: {
              select: { accountNumber: true },
            },
          },
        },
      },
      orderBy: [
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

    // Calculate running balances backwards from the current stored balance.
    const runningBalances = new Map();

    for (const account of user.accounts) {
      const entries = ledgerEntries.filter(
        (entry) => entry.accountId === account.id
      );

      let balance = account.balancePaise;

      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];

        runningBalances.set(entry.id, balance.toString());

        if (entry.direction === "CREDIT") {
          balance -= entry.amountPaise;
        } else if (entry.direction === "DEBIT") {
          balance += entry.amountPaise;
        }
      }
    }

    const transactions = ledgerEntries
      .map((entry) => {
        const transaction = entry.transaction;

        const account = user.accounts.find(
          (item) => item.id === entry.accountId
        );

        return {
          ledgerEntryId: entry.id,
          transactionId: transaction.id,
          accountId: entry.accountId,
          accountNumber: account?.accountNumber || null,
          type: transaction.type,
          status: transaction.status,
          direction: entry.direction,
          amountPaise: entry.amountPaise.toString(),
          amountRupees: (
            Number(entry.amountPaise) / 100
          ).toFixed(2),
          description: transaction.description,
          fromAccountNumber:
            transaction.fromAccount?.accountNumber || null,
          toAccountNumber:
            transaction.toAccount?.accountNumber || null,
          initiator: transaction.initiatedBy
            ? {
                id: transaction.initiatedBy.id,
                name: transaction.initiatedBy.fullName,
                email: transaction.initiatedBy.email,
                role: transaction.initiatedBy.role,
              }
            : null,
          runningBalancePaise: runningBalances.get(entry.id),
          createdAt: entry.createdAt,
        };
      })
      .sort((a, b) => {
        const difference =
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime();

        return difference ||
          b.ledgerEntryId.localeCompare(a.ledgerEntryId);
      });

    // Refused attempts are audit events, not financial transactions.
    const refusedAttempts = await prisma.auditLog.findMany({
      where: {
        actorId: user.id,
        action: {
          in: [
            "MONEY_TRANSFER_REFUSED",
            "WITHDRAWAL_REFUSED",
          ],
        },
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = transactions.length;
    const startIndex = (page - 1) * limit;

    const paginatedTransactions = transactions.slice(
      startIndex,
      startIndex + limit
    );

    return res.status(200).json({
      message: "Statement retrieved successfully",

      accounts: user.accounts.map((account) => ({
        accountId: account.id,
        accountNumber: account.accountNumber,
        currency: account.currency,
        currentBalancePaise: account.balancePaise.toString(),
        currentBalanceRupees: (
          Number(account.balancePaise) / 100
        ).toFixed(2),
      })),

      transactions: paginatedTransactions,

      refusedAttempts: refusedAttempts.map((attempt) => ({
        id: attempt.id,
        action: attempt.action,
        entityType: attempt.entityType,
        reason: attempt.metadata?.reason || null,
        amountPaise: attempt.metadata?.amountPaise || null,
        metadata: attempt.metadata,
        balanceAffected: false,
        createdAt: attempt.createdAt,
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Transaction statement error:", error);

    return res.status(500).json({
      message: "Could not retrieve transaction statement",
    });
  }
};

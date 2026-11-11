
import { z } from "zod";
import prisma from "../config/prisma.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function getPagination(query) {
  const result = paginationSchema.safeParse(query);

  if (!result.success) {
    return null;
  }

  const { page, limit } = result.data;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

// READ-ONLY: Inspect financial transactions
export const getAuditTransactions = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({
        message: "Invalid pagination parameters",
      });
    }

    const { page, limit, skip } = pagination;

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        include: {
          fromAccount: {
            select: {
              accountNumber: true,
              type: true,
            },
          },
          toAccount: {
            select: {
              accountNumber: true,
              type: true,
            },
          },
          initiatedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          ledgerEntries: {
            select: {
              id: true,
              direction: true,
              amountPaise: true,
              account: {
                select: {
                  accountNumber: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.transaction.count(),
    ]);

    const records = transactions.map((transaction) => {
      const debits = transaction.ledgerEntries
        .filter((entry) => entry.direction === "DEBIT")
        .reduce((sum, entry) => sum + entry.amountPaise, 0n);

      const credits = transaction.ledgerEntries
        .filter((entry) => entry.direction === "CREDIT")
        .reduce((sum, entry) => sum + entry.amountPaise, 0n);

      return {
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amountPaise: transaction.amountPaise.toString(),
        description: transaction.description,
        fromAccount: transaction.fromAccount,
        toAccount: transaction.toAccount,
        initiatedBy: transaction.initiatedBy,
        ledger: {
          entries: transaction.ledgerEntries.map((entry) => ({
            id: entry.id,
            direction: entry.direction,
            amountPaise: entry.amountPaise.toString(),
            accountNumber: entry.account.accountNumber,
          })),
          totalDebitsPaise: debits.toString(),
          totalCreditsPaise: credits.toString(),
          balanced:
            transaction.ledgerEntries.length === 2 &&
            debits === credits,
        },
        createdAt: transaction.createdAt,
      };
    });

    return res.status(200).json({
      message: "Audit transactions retrieved successfully",
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      transactions: records,
    });
  } catch (error) {
    console.error("Auditor transaction error:", error);

    return res.status(500).json({
      message: "Could not retrieve audit transactions",
    });
  }
};

// READ-ONLY: Inspect ledger entries
export const getAuditLedger = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({
        message: "Invalid pagination parameters",
      });
    }

    const { page, limit, skip } = pagination;

    const [entries, total] = await prisma.$transaction([
      prisma.ledgerEntry.findMany({
        include: {
          account: {
            select: {
              accountNumber: true,
              type: true,
              currency: true,
            },
          },
          transaction: {
            select: {
              id: true,
              type: true,
              status: true,
              amountPaise: true,
              description: true,
              initiatedBy: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.ledgerEntry.count(),
    ]);

    return res.status(200).json({
      message: "Audit ledger retrieved successfully",
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        direction: entry.direction,
        amountPaise: entry.amountPaise.toString(),
        account: entry.account,
        transaction: {
          ...entry.transaction,
          amountPaise: entry.transaction.amountPaise.toString(),
        },
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    console.error("Auditor ledger error:", error);

    return res.status(500).json({
      message: "Could not retrieve audit ledger",
    });
  }
};

// READ-ONLY: Inspect security and audit events
export const getAuditLogs = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    if (!pagination) {
      return res.status(400).json({
        message: "Invalid pagination parameters",
      });
    }

    const { page, limit, skip } = pagination;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.auditLog.count(),
    ]);

    return res.status(200).json({
      message: "Audit logs retrieved successfully",
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      logs,
    });
  } catch (error) {
    console.error("Auditor log error:", error);

    return res.status(500).json({
      message: "Could not retrieve audit logs",
    });
  }
};

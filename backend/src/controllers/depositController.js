
import { createHash } from "crypto";
import { z } from "zod";
import prisma from "../config/prisma.js";

const SYSTEM_ACCOUNT_NUMBER = "BV-SYSTEM-FUNDING";

const depositSchema = z.object({
  accountNumber: z.string().trim().min(1).max(30),
  amountPaise: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
  description: z.string().trim().max(200).optional(),
});

function makeRequestHash(adminId, accountNumber, amountPaise, description) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        adminId,
        accountNumber,
        amountPaise,
        description: description || "",
      })
    )
    .digest("hex");
}

function formatTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amountPaise: transaction.amountPaise.toString(),
    amountRupees: (
      Number(transaction.amountPaise) / 100
    ).toFixed(2),
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
    createdAt: transaction.createdAt,
  };
}

export const createDeposit = async (req, res) => {
  const validation = depositSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid deposit details",
      errors: validation.error.flatten(),
    });
  }

  const idempotencyKey = req.get("Idempotency-Key");

  if (
    !idempotencyKey ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 128
  ) {
    return res.status(400).json({
      message: "A valid Idempotency-Key header is required",
    });
  }

  const { accountNumber, amountPaise, description } = validation.data;
  const adminId = req.user.id;
  const amount = BigInt(amountPaise);

  const requestHash = makeRequestHash(
    adminId,
    accountNumber,
    amountPaise,
    description
  );

  try {
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
      include: { transaction: true },
    });

    if (existingKey) {
      if (existingKey.requestHash !== requestHash) {
        return res.status(409).json({
          message: "This idempotency key was used for a different request",
        });
      }

      if (!existingKey.transaction) {
        return res.status(409).json({
          message: "Previous request is still being processed",
        });
      }

      return res.status(200).json({
        message: "Duplicate deposit request. Original result returned.",
        duplicate: true,
        transaction: formatTransaction(existingKey.transaction),
      });
    }

    let result;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            // Verify the customer and onboarding status.
            const customerAccount = await tx.account.findUnique({
              where: { accountNumber },
              include: {
                user: {
                  include: {
                    onboardingRequest: true,
                  },
                },
              },
            });

            if (
              !customerAccount ||
              customerAccount.type !== "CUSTOMER" ||
              customerAccount.status !== "ACTIVE" ||
              !customerAccount.user ||
              customerAccount.user.status !== "ACTIVE" ||
              customerAccount.user.onboardingRequest?.status !== "APPROVED"
            ) {
              throw new Error("CUSTOMER_ACCOUNT_NOT_ELIGIBLE");
            }

            // Create the internal system funding account if needed.
            const systemAccount = await tx.account.upsert({
              where: {
                accountNumber: SYSTEM_ACCOUNT_NUMBER,
              },
              update: {},
              create: {
                accountNumber: SYSTEM_ACCOUNT_NUMBER,
                userId: null,
                type: "SYSTEM",
                balancePaise: 0n,
                currency: customerAccount.currency,
                status: "ACTIVE",
              },
            });

            if (
              systemAccount.type !== "SYSTEM" ||
              systemAccount.status !== "ACTIVE" ||
              systemAccount.currency !== customerAccount.currency
            ) {
              throw new Error("SYSTEM_ACCOUNT_UNAVAILABLE");
            }

            // Claim the idempotency key.
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                requestHash,
              },
            });

            // Record the incoming funds in the system account.
            await tx.account.update({
              where: { id: systemAccount.id },
              data: {
                balancePaise: {
                  increment: amount,
                },
              },
            });

            // Credit the customer's account.
            const credit = await tx.account.updateMany({
              where: {
                id: customerAccount.id,
                status: "ACTIVE",
                type: "CUSTOMER",
              },
              data: {
                balancePaise: {
                  increment: amount,
                },
              },
            });

            if (credit.count !== 1) {
              throw new Error("CUSTOMER_ACCOUNT_NOT_ELIGIBLE");
            }

            // Create the deposit transaction.
            const transaction = await tx.transaction.create({
              data: {
                type: "DEPOSIT",
                status: "COMPLETED",
                amountPaise: amount,
                description: description || "Admin-approved deposit",
                fromAccountId: systemAccount.id,
                toAccountId: customerAccount.id,
                initiatedById: adminId,
              },
            });

            // Create the two matching ledger entries.
            await tx.ledgerEntry.createMany({
              data: [
                {
                  transactionId: transaction.id,
                  accountId: systemAccount.id,
                  direction: "DEBIT",
                  amountPaise: amount,
                },
                {
                  transactionId: transaction.id,
                  accountId: customerAccount.id,
                  direction: "CREDIT",
                  amountPaise: amount,
                },
              ],
            });

            // Link the idempotency key to the transaction.
            await tx.idempotencyKey.update({
              where: { key: idempotencyKey },
              data: {
                transactionId: transaction.id,
              },
            });

            // Record the admin action.
            await tx.auditLog.create({
              data: {
                actorId: adminId,
                action: "CUSTOMER_DEPOSIT_COMPLETED",
                entityType: "Transaction",
                entityId: transaction.id,
                metadata: {
                  accountNumber,
                  systemAccountId: systemAccount.id,
                  customerAccountId: customerAccount.id,
                  amountPaise: amount.toString(),
                },
                ipAddress: req.ip,
              },
            });

            return transaction;
          },
          {
            isolationLevel: "Serializable",
          }
        );

        break;
      } catch (error) {
        if (error.code === "P2034") {
          if (attempt < 3) {
            continue;
          }

          throw new Error("DEPOSIT_RETRY_EXHAUSTED");
        }

        throw error;
      }
    }

    if (!result) {
      throw new Error("DEPOSIT_RETRY_EXHAUSTED");
    }

    return res.status(201).json({
      message: "Deposit completed successfully",
      duplicate: false,
      transaction: formatTransaction(result),
    });
  } catch (error) {
    if (error.code === "P2002") {
      const previous = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
        include: { transaction: true },
      });

      if (
        previous &&
        previous.requestHash === requestHash &&
        previous.transaction
      ) {
        return res.status(200).json({
          message: "Duplicate deposit request. Original result returned.",
          duplicate: true,
          transaction: formatTransaction(previous.transaction),
        });
      }

      return res.status(409).json({
        message: "Idempotency key conflict",
      });
    }

    const errors = {
      CUSTOMER_ACCOUNT_NOT_ELIGIBLE: [
        400,
        "Customer account was not found, approved, or active",
      ],
      SYSTEM_ACCOUNT_UNAVAILABLE: [
        503,
        "System funding account is unavailable",
      ],
      DEPOSIT_RETRY_EXHAUSTED: [
        503,
        "Deposit could not be completed. Retry using the same idempotency key",
      ],
    };

    if (errors[error.message]) {
      const [status, message] = errors[error.message];
      return res.status(status).json({ message });
    }

    console.error("Deposit error:", error);

    return res.status(500).json({
      message: "Deposit failed. No money was moved.",
    });
  }
};

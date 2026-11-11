
import { createHash } from "crypto";
import { z } from "zod";
import prisma from "../config/prisma.js";

const SYSTEM_ACCOUNT_NUMBER = "BV-SYSTEM-FUNDING";

const withdrawalSchema = z.object({
  amountPaise: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
  description: z.string().trim().max(200).optional(),
});

function makeRequestHash(userId, amountPaise, description) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId,
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

export const withdrawMoney = async (req, res) => {
  const validation = withdrawalSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid withdrawal details",
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

  const { amountPaise, description } = validation.data;
  const userId = req.user.id;
  const amount = BigInt(amountPaise);

  const requestHash = makeRequestHash(
    userId,
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
        message: "Duplicate withdrawal request. Original result returned.",
        duplicate: true,
        transaction: formatTransaction(existingKey.transaction),
      });
    }

    let result;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            // Verify the account holder.
            const user = await tx.user.findUnique({
              where: { id: userId },
              include: {
                onboardingRequest: true,
              },
            });

            if (!user || user.status !== "ACTIVE") {
              throw new Error("USER_NOT_ACTIVE");
            }

            if (
              user.onboardingRequest?.status !== "APPROVED"
            ) {
              throw new Error("ONBOARDING_NOT_APPROVED");
            }

            // Find the account holder's active wallet.
            const customerAccount = await tx.account.findFirst({
              where: {
                userId,
                type: "CUSTOMER",
                status: "ACTIVE",
              },
              orderBy: {
                createdAt: "asc",
              },
            });

            if (!customerAccount) {
              throw new Error("CUSTOMER_ACCOUNT_NOT_FOUND");
            }

            // Find the existing system funding account.
            const systemAccount = await tx.account.findUnique({
              where: {
                accountNumber: SYSTEM_ACCOUNT_NUMBER,
              },
            });

            if (
              !systemAccount ||
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

            // Debit the customer only when sufficient funds exist.
            const customerDebit = await tx.account.updateMany({
              where: {
                id: customerAccount.id,
                type: "CUSTOMER",
                status: "ACTIVE",
                balancePaise: {
                  gte: amount,
                },
              },
              data: {
                balancePaise: {
                  decrement: amount,
                },
              },
            });

            if (customerDebit.count !== 1) {
              throw new Error("INSUFFICIENT_CUSTOMER_FUNDS");
            }

            // Reduce the system funding account balance.
            // If this fails, the complete transaction rolls back.
            const systemDebit = await tx.account.updateMany({
              where: {
                id: systemAccount.id,
                type: "SYSTEM",
                status: "ACTIVE",
                currency: customerAccount.currency,
                balancePaise: {
                  gte: amount,
                },
              },
              data: {
                balancePaise: {
                  decrement: amount,
                },
              },
            });

            if (systemDebit.count !== 1) {
              throw new Error("INSUFFICIENT_SYSTEM_FUNDS");
            }

            // Create the completed withdrawal transaction.
            const transaction = await tx.transaction.create({
              data: {
                type: "WITHDRAWAL",
                status: "COMPLETED",
                amountPaise: amount,
                description: description || "Account withdrawal",
                fromAccountId: customerAccount.id,
                toAccountId: systemAccount.id,
                initiatedById: userId,
              },
            });

            // Customer DEBIT and system CREDIT.
            await tx.ledgerEntry.createMany({
              data: [
                {
                  transactionId: transaction.id,
                  accountId: customerAccount.id,
                  direction: "DEBIT",
                  amountPaise: amount,
                },
                {
                  transactionId: transaction.id,
                  accountId: systemAccount.id,
                  direction: "CREDIT",
                  amountPaise: amount,
                },
              ],
            });

            // Link the idempotency key.
            await tx.idempotencyKey.update({
              where: {
                key: idempotencyKey,
              },
              data: {
                transactionId: transaction.id,
              },
            });

            // Record successful withdrawal.
            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: "WITHDRAWAL_COMPLETED",
                entityType: "Transaction",
                entityId: transaction.id,
                metadata: {
                  customerAccountId: customerAccount.id,
                  systemAccountId: systemAccount.id,
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

          throw new Error("WITHDRAWAL_RETRY_EXHAUSTED");
        }

        throw error;
      }
    }

    if (!result) {
      throw new Error("WITHDRAWAL_RETRY_EXHAUSTED");
    }

    return res.status(201).json({
      message: "Withdrawal completed successfully",
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
          message: "Duplicate withdrawal request. Original result returned.",
          duplicate: true,
          transaction: formatTransaction(previous.transaction),
        });
      }

      return res.status(409).json({
        message: "Idempotency key conflict",
      });
    }

    const errors = {
      USER_NOT_ACTIVE: [
        403,
        "Your user account is not active",
      ],
      ONBOARDING_NOT_APPROVED: [
        403,
        "Your onboarding is not approved",
      ],
      CUSTOMER_ACCOUNT_NOT_FOUND: [
        404,
        "Your active customer account was not found",
      ],
      SYSTEM_ACCOUNT_UNAVAILABLE: [
        503,
        "System funding account is unavailable",
      ],
      INSUFFICIENT_CUSTOMER_FUNDS: [
        400,
        "Insufficient customer balance",
      ],
      INSUFFICIENT_SYSTEM_FUNDS: [
        503,
        "Withdrawal cannot be completed because system funds are insufficient",
      ],
      WITHDRAWAL_RETRY_EXHAUSTED: [
        503,
        "Withdrawal could not be completed. Retry using the same idempotency key",
      ],
    };

    if (errors[error.message]) {
      const [status, message] = errors[error.message];

      const refusedReasons = [
        "USER_NOT_ACTIVE",
        "ONBOARDING_NOT_APPROVED",
        "CUSTOMER_ACCOUNT_NOT_FOUND",
        "SYSTEM_ACCOUNT_UNAVAILABLE",
        "INSUFFICIENT_CUSTOMER_FUNDS",
        "INSUFFICIENT_SYSTEM_FUNDS",
      ];

      if (refusedReasons.includes(error.message)) {
        try {
          await prisma.auditLog.create({
            data: {
              actorId: userId,
              action: "WITHDRAWAL_REFUSED",
              entityType: "WithdrawalAttempt",
              metadata: {
                reason: error.message,
                amountPaise: amount.toString(),
              },
              ipAddress: req.ip,
            },
          });
        } catch (auditError) {
          console.error(
            "Failed to record refused withdrawal:",
            auditError
          );
        }
      }

      return res.status(status).json({
        message,
      });
    }

    console.error("Withdrawal error:", error);

    return res.status(500).json({
      message: "Withdrawal failed. No money was moved.",
    });
  }
};

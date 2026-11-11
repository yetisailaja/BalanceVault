
import { createHash } from "crypto";
import { z } from "zod";
import prisma from "../config/prisma.js";

const transferSchema = z.object({
  toAccountNumber: z.string().trim().min(1).max(30),
  amountPaise: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
  description: z.string().trim().max(200).optional(),
});

function makeRequestHash(
  userId,
  toAccountNumber,
  amountPaise,
  description
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId,
        toAccountNumber,
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

export const transferMoney = async (req, res) => {
  const validation = transferSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid transfer details",
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

  const {
    toAccountNumber,
    amountPaise,
    description,
  } = validation.data;

  const userId = req.user.id;

  const requestHash = makeRequestHash(
    userId,
    toAccountNumber,
    amountPaise,
    description
  );

  const amount = BigInt(amountPaise);

  try {
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: {
        key: idempotencyKey,
      },
      include: {
        transaction: true,
      },
    });

    if (existingKey) {
      if (existingKey.requestHash !== requestHash) {
        return res.status(409).json({
          message:
            "This idempotency key was already used for a different request",
        });
      }

      if (!existingKey.transaction) {
        return res.status(409).json({
          message: "Previous request is still being processed",
        });
      }

      return res.status(200).json({
        message:
          "Duplicate request detected. Original transfer returned.",
        duplicate: true,
        transaction: formatTransaction(existingKey.transaction),
      });
    }

    let result;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            // Verify sender.
            const user = await tx.user.findUnique({
              where: {
                id: userId,
              },
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

            // Find sender's active customer account.
            const sender = await tx.account.findFirst({
              where: {
                userId,
                type: "CUSTOMER",
                status: "ACTIVE",
              },
              orderBy: {
                createdAt: "asc",
              },
            });

            if (!sender) {
              throw new Error("SENDER_ACCOUNT_NOT_FOUND");
            }

            // Find recipient and verify account owner.
            const receiver = await tx.account.findUnique({
              where: {
                accountNumber: toAccountNumber,
              },
              include: {
                user: {
                  select: {
                    status: true,
                    onboardingRequest: {
                      select: {
                        status: true,
                      },
                    },
                  },
                },
              },
            });

            if (
              !receiver ||
              receiver.type !== "CUSTOMER" ||
              receiver.status !== "ACTIVE" ||
              !receiver.user ||
              receiver.user.status !== "ACTIVE" ||
              receiver.user.onboardingRequest?.status !== "APPROVED"
            ) {
              throw new Error("RECEIVER_NOT_FOUND");
            }

            if (sender.id === receiver.id) {
              throw new Error("SAME_ACCOUNT");
            }

            if (sender.currency !== receiver.currency) {
              throw new Error("CURRENCY_MISMATCH");
            }

            // Claim idempotency key.
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                requestHash,
              },
            });

            // Debit sender only if sufficient funds exist.
            const debit = await tx.account.updateMany({
              where: {
                id: sender.id,
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

            if (debit.count !== 1) {
              throw new Error("INSUFFICIENT_FUNDS");
            }

            // Credit receiver.
            const credit = await tx.account.updateMany({
              where: {
                id: receiver.id,
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
              throw new Error("RECEIVER_NOT_FOUND");
            }

            // Create transfer transaction.
            const transaction = await tx.transaction.create({
              data: {
                type: "TRANSFER",
                status: "COMPLETED",
                amountPaise: amount,
                description: description || "Account transfer",
                fromAccountId: sender.id,
                toAccountId: receiver.id,
                initiatedById: userId,
              },
            });

            // Create double-entry ledger.
            await tx.ledgerEntry.createMany({
              data: [
                {
                  transactionId: transaction.id,
                  accountId: sender.id,
                  direction: "DEBIT",
                  amountPaise: amount,
                },
                {
                  transactionId: transaction.id,
                  accountId: receiver.id,
                  direction: "CREDIT",
                  amountPaise: amount,
                },
              ],
            });

            // Link idempotency key.
            await tx.idempotencyKey.update({
              where: {
                key: idempotencyKey,
              },
              data: {
                transactionId: transaction.id,
              },
            });

            // Create audit log.
            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: "MONEY_TRANSFER_COMPLETED",
                entityType: "Transaction",
                entityId: transaction.id,
                metadata: {
                  fromAccountId: sender.id,
                  toAccountId: receiver.id,
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

          throw new Error("TRANSFER_RETRY_EXHAUSTED");
        }

        throw error;
      }
    }

    if (!result) {
      throw new Error("TRANSFER_RETRY_EXHAUSTED");
    }

    return res.status(201).json({
      message: "Money transferred successfully",
      duplicate: false,
      transaction: formatTransaction(result),
    });
  } catch (error) {
    if (error.code === "P2002") {
      const previous = await prisma.idempotencyKey.findUnique({
        where: {
          key: idempotencyKey,
        },
        include: {
          transaction: true,
        },
      });

      if (
        previous &&
        previous.requestHash === requestHash &&
        previous.transaction
      ) {
        return res.status(200).json({
          message:
            "Duplicate request detected. Original transfer returned.",
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
      SENDER_ACCOUNT_NOT_FOUND: [
        404,
        "Your active account was not found",
      ],
      RECEIVER_NOT_FOUND: [
        404,
        "Recipient account was not found or is inactive",
      ],
      SAME_ACCOUNT: [
        400,
        "You cannot transfer money to the same account",
      ],
      CURRENCY_MISMATCH: [
        400,
        "Account currencies do not match",
      ],
      INSUFFICIENT_FUNDS: [
        400,
        "Insufficient balance",
      ],
      TRANSFER_RETRY_EXHAUSTED: [
        503,
        "Transfer could not be completed. Retry using the same idempotency key",
      ],
    };

    if (errors[error.message]) {
      const [status, message] = errors[error.message];

      const refusedReasons = [
        "USER_NOT_ACTIVE",
        "ONBOARDING_NOT_APPROVED",
        "SENDER_ACCOUNT_NOT_FOUND",
        "RECEIVER_NOT_FOUND",
        "SAME_ACCOUNT",
        "CURRENCY_MISMATCH",
        "INSUFFICIENT_FUNDS",
      ];

      if (refusedReasons.includes(error.message)) {
        try {
          await prisma.auditLog.create({
            data: {
              actorId: userId,
              action: "MONEY_TRANSFER_REFUSED",
              entityType: "TransferAttempt",
              metadata: {
                reason: error.message,
                toAccountNumber,
                amountPaise: amount.toString(),
              },
              ipAddress: req.ip,
            },
          });
        } catch (auditError) {
          console.error(
            "Failed to record refused transfer:",
            auditError
          );
        }
      }

      return res.status(status).json({
        message,
      });
    }

    console.error("Transfer error:", error);

    return res.status(500).json({
      message: "Transfer failed. No money was moved.",
    });
  }
};

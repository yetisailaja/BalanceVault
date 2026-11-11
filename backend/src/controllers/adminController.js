import { randomInt } from "crypto";
import { z } from "zod";
import prisma from "../config/prisma.js";

export const getPendingCustomers = async (req, res) => {
  try {
    const requests = await prisma.onboardingRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return res.json({
      message: "Pending customers retrieved successfully",
      requests
    });
  } catch (error) {
    console.error("Pending customers error:", error);
    return res.status(500).json({
      message: "Could not retrieve pending customers"
    });
  }
};

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(500).optional()
});

export const reviewCustomer = async (req, res) => {
  const validation = reviewSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Invalid review details",
      errors: validation.error.flatten()
    });
  }

  const { status, reviewNote } = validation.data;
  const { userId } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.onboardingRequest.findUnique({
        where: { userId },
        include: { user: true }
      });

      if (!request) {
        throw new Error("ONBOARDING_NOT_FOUND");
      }

      if (request.status !== "PENDING") {
        throw new Error("ALREADY_REVIEWED");
      }

      if (status === "APPROVED") {
        const accountNumber = `BV${randomInt(
          1000000000,
          9999999999
        )}`;

        await tx.account.create({
          data: {
            accountNumber,
            userId,
            balancePaise: 0,
            status: "ACTIVE",
            currency: "INR"
          }
        });
      }

      const updatedRequest = await tx.onboardingRequest.update({
        where: { userId },
        data: {
          status,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: `CUSTOMER_${status}`,
          entityType: "OnboardingRequest",
          entityId: request.id,
          metadata: {
            customerId: userId,
            reviewNote: reviewNote || null
          }
        }
      });

      return updatedRequest;
    });

    return res.json({
      message: `Customer ${status.toLowerCase()} successfully`,
      request: result
    });
  } catch (error) {
    if (error.message === "ONBOARDING_NOT_FOUND") {
      return res.status(404).json({
        message: "Customer onboarding request not found"
      });
    }

    if (error.message === "ALREADY_REVIEWED") {
      return res.status(409).json({
        message: "This customer has already been reviewed"
      });
    }

    console.error("Customer review error:", error);

    return res.status(500).json({
      message: "Could not review customer"
    });
  }
};
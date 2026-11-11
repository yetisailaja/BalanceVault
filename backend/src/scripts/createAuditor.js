
import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

async function createAuditor() {
  try {
    const email = process.env.AUDITOR_EMAIL?.trim().toLowerCase();
    const password = process.env.AUDITOR_PASSWORD;

    if (!email || !password || password.length < 12) {
      throw new Error(
        "Set AUDITOR_EMAIL and AUDITOR_PASSWORD (minimum 12 characters) in .env"
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("A user with this email already exists.");
      console.log("No role, password, or account data was changed.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const auditor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: "BalanceVault Auditor",
          email,
          passwordHash,
          role: "AUDITOR",
          status: "ACTIVE",
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUDITOR_ACCOUNT_CREATED",
          entityType: "USER",
          entityId: user.id,
          metadata: {
            role: "AUDITOR",
            creationMethod: "SECURE_SETUP_SCRIPT",
          },
        },
      });

      return user;
    });

    console.log("Auditor account created successfully.");
    console.log("Auditor ID:", auditor.id);
    console.log("Auditor email:", auditor.email);
    console.log("Auditor role:", auditor.role);
    console.log("Auditor status:", auditor.status);
  } catch (error) {
    console.error("Auditor creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

createAuditor();

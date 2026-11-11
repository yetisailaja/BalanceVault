
import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

async function createAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password || password.length < 12) {
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters) in .env"
      );
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log("A user with this email already exists.");
      console.log("No role or password was changed.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        fullName: "BalanceVault Administrator",
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    console.log("Admin account created successfully.");
    console.log("Admin ID:", admin.id);
    console.log("Admin email:", admin.email);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

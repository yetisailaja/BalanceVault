
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../config/prisma.js";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};

// REGISTER
export const register = async (req, res) => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid registration details",
        errors: validation.error.issues,
      });
    }

    const { fullName, password } = validation.data;
    const email = validation.data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,

          // Public registration always creates an account holder.
          // Never accept a role from the client.
          role: "ACCOUNT_HOLDER",
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

      await tx.onboardingRequest.create({
        data: {
          userId: newUser.id,
          status: "PENDING",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: newUser.id,
          action: "USER_REGISTERED",
          entityType: "USER",
          entityId: newUser.id,
        },
      });

      return newUser;
    });

    const token = createToken(user);

    return res.status(201).json({
      message:
        "Registration submitted. Your account is awaiting administrator approval.",
      user,
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid login details",
        errors: validation.error.issues,
      });
    }

    const email = validation.data.email.toLowerCase();
    const { password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Login failed",
    });
  }
};

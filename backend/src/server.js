
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import prisma from "./config/prisma.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import auditorRoutes from "./routes/auditorRoutes.js";

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

// JSON body parser
app.use(express.json({ limit: "10kb" }));

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to BalanceVault API",
    status: "running",
  });
});

// Backend health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "BalanceVault backend",
  });
});

// Database health check
app.get("/api/db-health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "connected",
      database: "PostgreSQL",
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Admin routes
app.use("/api/admin", adminRoutes);

// Account-holder routes
app.use("/api/accounts", accountRoutes);

// Money transfer routes
app.use("/api/transfers", transferRoutes);

// Money withdrawal routes
app.use("/api/withdrawals", withdrawalRoutes);

// Read-only auditor routes
app.use("/api/auditor", auditorRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: "API route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    message: "Internal server error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`BalanceVault API running on port ${PORT}`);
});

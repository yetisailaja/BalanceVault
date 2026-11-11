
import express from "express";

import {
  authenticate,
  authorize,
} from "../middleware/authMiddleware.js";

import {
  getAuditTransactions,
  getAuditLedger,
  getAuditLogs,
} from "../controllers/auditorController.js";

const router = express.Router();

// Every endpoint requires an authenticated AUDITOR.
router.use(authenticate, authorize("AUDITOR"));

// Read-only financial transaction inspection
router.get("/transactions", getAuditTransactions);

// Read-only ledger inspection
router.get("/ledger", getAuditLedger);

// Read-only security and audit history
router.get("/logs", getAuditLogs);

export default router;

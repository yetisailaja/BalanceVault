
import express from "express";

import {
  getPendingCustomers,
  reviewCustomer,
} from "../controllers/adminController.js";

import { createDeposit } from "../controllers/depositController.js";

import {
  authenticate,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All admin routes require a valid ADMIN token.
router.use(authenticate, authorize("ADMIN"));

// Customer onboarding.
router.get("/onboarding/pending", getPendingCustomers);
router.patch("/onboarding/:userId/review", reviewCustomer);

// Admin-controlled customer deposit.
router.post("/deposits", createDeposit);

export default router;

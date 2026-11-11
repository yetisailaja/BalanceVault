
import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { getMyAccount, getMyTransactions } from "../controllers/accountController.js";

const router = express.Router();

router.get("/me", authenticate, getMyAccount);
router.get("/transactions", authenticate, getMyTransactions);

export default router;

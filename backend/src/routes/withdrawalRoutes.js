import express from "express";
import {
  authenticate,
  authorize,
} from "../middleware/authMiddleware.js";
import { withdrawMoney } from "../controllers/withdrawalController.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("ACCOUNT_HOLDER"),
  withdrawMoney
);

export default router;
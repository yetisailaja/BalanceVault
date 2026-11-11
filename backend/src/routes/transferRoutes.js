
import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { transferMoney } from "../controllers/transferController.js";

const router = express.Router();

router.post("/", authenticate, transferMoney);

export default router;

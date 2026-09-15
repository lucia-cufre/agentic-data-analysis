import { Router } from "express";
import chatRouter from "./chat.js";

const router = Router();

router.use("/api/chat", chatRouter);

export default router;

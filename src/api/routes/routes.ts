import { Router } from "express";
import chatRouter from "./chat";

const router = Router();

router.use("/api/chat", chatRouter);

export default router;

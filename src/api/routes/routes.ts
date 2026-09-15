import { Router } from "express";
import callAgentsRouter from "./call-agents";

const router = Router();

router.use("/api/call-agents", callAgentsRouter);

export default router;

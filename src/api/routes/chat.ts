import { randomUUID } from "node:crypto";
import { Router } from "express";
import { runAgent } from "../../agent/agent.js";
import { Message } from "../../agent/types.js";

const chatRouter = Router();

const conversations = new Map<string, Message[]>();

chatRouter.post("/", async (req, res) => {
    try {
      const { question, conversationId } = req.body ?? {};

      if (typeof question !== "string" || question.trim() === "") {
        return res.status(400).json({ error: "question is required" });
      }

      const id = typeof conversationId === "string" ? conversationId : randomUUID();
      const history = conversations.get(id) ?? [];

      const { text, charts, history: updatedHistory } = await runAgent(question, history);
      conversations.set(id, updatedHistory);

      return res.json({ text, charts, conversationId: id });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to process the question" });
    }
});

export default chatRouter;
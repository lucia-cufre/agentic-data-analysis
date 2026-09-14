import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { randomUUID } from "node:crypto";
import { runAgent, Message } from "./agent/agent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../public");

const conversations = new Map<string, Message[]>();

const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  app.post("/api/chat", async (req, res) => {
    try {
      const { question, conversationId } = req.body ?? {};

      if (typeof question !== "string" || question.trim() === "") {
        res.status(400).json({ error: "question is required" });
        return;
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

  return app;
};

const app = createApp();

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

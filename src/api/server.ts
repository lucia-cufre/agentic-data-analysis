import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { NextFunction, Request, Response } from "express";
import router from "./routes/routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "../../public");


const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));
  app.use(router);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
};

export const app = createApp();

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

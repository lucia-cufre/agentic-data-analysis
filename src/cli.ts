import "dotenv/config";
import { runAgent } from "./agent";

const answer = await runAgent(
  "Compare revenue between December 2020 and January 2021, and tell me the top 3 products in each month.",
);
console.log(answer);
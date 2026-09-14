import "dotenv/config";
import { runAgent } from "./agent/agent";

let history: any[] = [];

const first = await runAgent("show me revenue by month", history);
console.log(JSON.stringify(first.charts, null, 2));

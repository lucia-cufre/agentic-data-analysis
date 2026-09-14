import "dotenv/config";
import { runAgent } from "./agent";

let history: any[] = [];

const first = await runAgent("What was the total revenue in January 2021?", history);
console.log(first.text);
history = first.history;

const second = await runAgent("And in December?", history);
console.log(second.text);
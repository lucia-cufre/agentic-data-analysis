// Manual entry point: runs one question end to end against the Anthropic API
// and BigQuery. Useful for exercising the agent without the UI.
import "dotenv/config";
import { buildQuery, SCHEMA_DESCRIPTION } from "./schema";
import { executeQuery } from "./bigQuery";

const RUN_QUERY_TOOL = {
  name: "run_query",
  description:
    "Run a read-only SQL query against the GA4 ecommerce dataset and return the rows. " +
    "The date range is applied for you: pass start_date and end_date and write your " +
    "query against the sessions and items tables without any date filtering.",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description:
          "A SELECT query against the sessions and items tables. Aggregate rather " +
          "than selecting raw rows: results are capped at 1000 rows.",
      },
      start_date: {
        type: "string",
        description: "First day to include, YYYYMMDD. Dataset starts 20201101.",
      },
      end_date: {
        type: "string",
        description: "Last day to include, YYYYMMDD. Dataset ends 20210131.",
      },
    },
    required: ["sql", "start_date", "end_date"],
  },
};

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SCHEMA_DESCRIPTION,
    tools: [RUN_QUERY_TOOL],
    messages: [
      { role: "user", content: "What was the total revenue in January 2021?" },
    ],
  }),
});

const data = await response.json();
const toolUse = data.content.find((block: any) => block.type === "tool_use");
const { sql, start_date, end_date } = toolUse.input;
const finalSql = buildQuery(sql, start_date, end_date);
const result = await executeQuery(finalSql);

const response2 = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SCHEMA_DESCRIPTION,
    tools: [RUN_QUERY_TOOL],
    messages: [
      { role: "user", content: "What was the total revenue in January 2021?" },
      { role: "assistant", content: data.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          },
        ],
      },
    ],
  }),
});

const data2 = await response2.json();
console.log(JSON.stringify(data2, null, 2));
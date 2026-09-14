import { buildQuery } from "./schema";
import { executeQuery } from "../connection/bigQuery";
import { validateDateRange, validateSql } from "../validators/query-validation";
import { SYSTEM_PROMPT } from "./prompt";
import {
  ChartSpec,
  ChartType,
  validateChartSpec,
} from "../validators/chart-validation";

const MAX_TURNS = 10;

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

type ModelResponse = {
  content: ContentBlock[];
  stop_reason: "tool_use" | "end_turn" | "max_tokens";
};

type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

type Message = {
  role: "user" | "assistant";
  content: string | ContentBlock[] | ToolResultBlock[];
};

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

const CREATE_CHART_TOOL = {
  name: "create_chart",
  description:
    "Render a chart from data already returned by run_query." +
    "Use it when a chart makes the answer easier to understand, such as comparing values over time or across categories." +
    "Do not use it for a single number. Never invent values: every number must come from a query result.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["bar", "line", "pie"],
        description:
          "line for trends over time, bar for comparing categories, pie for parts of a whole.",
      },
      title: {
        type: "string",
        description:
          "A relevant short title describing what the chart shows, 4 words maximum.",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description:
          "The x-axis categories, for example dates or product names. For a pie chart, the slice names.",
      },
      series: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            values: { type: "array", items: { type: "number" } },
          },
          required: ["name", "values"],
        },
        description:
          "One entry per line or bar group. Each series needs a name for the legend " +
          "and a values array with exactly the same length as labels, in the same order. " +
          "A pie chart takes exactly one series.",
      },
    },
    required: ["type", "title", "labels", "series"],
  },
};

async function callModel(messages: any[]): Promise<ModelResponse> {
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
      system: SYSTEM_PROMPT,
      tools: [RUN_QUERY_TOOL, CREATE_CHART_TOOL],
      messages,
    }),
  });

  return response.json();
}

function toolResult(toolUseId: string, payload: unknown) {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify(payload),
  };
}

export async function runAgent(
  question: string,
  history: Message[] = [],
): Promise<{ text: string; charts: ChartSpec[]; history: Message[] }> {
  const messages: any[] = [...history, { role: "user", content: question }];
  const charts: ChartSpec[] = [];

  for (let i = 0; i < MAX_TURNS; i++) {
    const data = await callModel(messages);
    if (data.stop_reason !== "tool_use") {
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      messages.push({ role: "assistant", content: data.content });
      return { text, charts, history: messages };
    }

    const toolUse = data.content.filter(
      (block): block is Extract<ContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use",
    );
    const toolResults = [];

    for (const block of toolUse) {
      if (block.name === "run_query") {
        const { sql, start_date, end_date } = block.input as {
          sql: string;
          start_date: string;
          end_date: string;
        };
        const checks = [
          validateSql(sql),
          validateDateRange(start_date, end_date),
        ];
        const failures = checks.filter((c) => !c.valid);

        if (failures.length > 0) {
          // If both validation fails, we return both data errors in the tool result.
          // This is to avoid the model having to fix one error, then getting another error on the next turn.
          toolResults.push(
            toolResult(block.id, { errors: failures.map((f) => f.error) }),
          );
          continue;
        }

        try {
          const finalSql = buildQuery(sql, start_date, end_date);
          const result = await executeQuery(finalSql);
          toolResults.push(toolResult(block.id, result));
        } catch (error) {
          toolResults.push(
            toolResult(block.id, {
              error: error instanceof Error ? error.message : "Query failed.",
            }),
          );
        }

      } else if (block.name === "create_chart") {
        const { type, title, labels, series } = block.input as {
          type: ChartType;
          title: string;
          labels: string[];
          series: { name: string; values: number[] }[];
        };

        const result = validateChartSpec(type, labels, series);

        if (!result.valid) {
          toolResults.push(toolResult(block.id, { error: result.error }));
          continue;
        }
        charts.push({ type, title, labels, series });
        toolResults.push(
          toolResult(block.id, { valid: true, message: "Chart created." }),
        );
      } else {
        toolResults.push(
          toolResult(block.id, { error: `Unknown tool: ${block.name}` }),
        );
      }
    }

    messages.push({ role: "assistant", content: data.content });
    messages.push({ role: "user", content: toolResults });
  }

  console.warn(`Turn limit (${MAX_TURNS}) reached before the model finished.`);
  const text = "I could not complete the analysis within the turn limit.";
  messages.push({ role: "assistant", content: text });
  return { text, charts, history: messages };
}

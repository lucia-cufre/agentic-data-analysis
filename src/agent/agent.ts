import { buildQuery } from "./schema";
import { executeQuery } from "../connection/bigQuery";
import { validateDateRange, validateSql } from "../validators/query-validation";
import { SYSTEM_PROMPT } from "./prompt";
import {
  ChartSpec,
  ChartType,
  validateChartSpec,
} from "../validators/chart-validation";
import { CREATE_CHART_TOOL, RUN_QUERY_TOOL } from "./tools";
import {
  ContentBlock,
  Message,
  ModelResponse,
  ToolResultBlock,
  ToolUseBlock,
} from "./types";

const MAX_TURNS = 10;

async function callModel(messages: Message[]): Promise<ModelResponse> {
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

  const data = await response.json();

  if (!response.ok || data.type === "error") {
    throw new Error(data.error?.message ?? "Model API request failed");
  }

  return data;
}

async function handleRunQuery(block: ToolUseBlock): Promise<ToolResultBlock> {
  const { sql, start_date, end_date } = block.input as {
    sql: string;
    start_date: string;
    end_date: string;
  };
  const checks = [validateSql(sql), validateDateRange(start_date, end_date)];
  const failures = checks.filter((c) => !c.valid);

  if (failures.length > 0) {
    // If both validation fails, we return both data errors in the tool result.
    // This is to avoid the model having to fix one error, then getting another error on the next turn.
    return toolResult(block.id, { errors: failures.map((f) => f.error) });
  }

  try {
    const finalSql = buildQuery(sql, start_date, end_date);
    const result = await executeQuery(finalSql);
    return toolResult(block.id, result);
  } catch (error) {
    return toolResult(block.id, {
      error: error instanceof Error ? error.message : "Query failed.",
    });
  }
}

function handleCreateChart(
  block: ToolUseBlock,
  charts: ChartSpec[],
): ToolResultBlock {
  const { type, title, description, labels, series } = block.input as {
    type: ChartType;
    title: string;
    description: string;
    labels: string[];
    series: { name: string; values: number[] }[];
  };

  const result = validateChartSpec(type, labels, series);

  if (!result.valid) {
    return toolResult(block.id, { error: result.error });
  }
  charts.push({ type, title, description, labels, series });
  return toolResult(block.id, { valid: true, message: "Chart created." });
}

function toolResult(toolUseId: string, payload: unknown): ToolResultBlock {
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
  const messages: Message[] = [...history, { role: "user", content: question }];
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
        toolResults.push(await handleRunQuery(block));
      } else if (block.name === "create_chart") {
        toolResults.push(handleCreateChart(block, charts));
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

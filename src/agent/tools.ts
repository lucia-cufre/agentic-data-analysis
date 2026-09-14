export const RUN_QUERY_TOOL = {
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

export const CREATE_CHART_TOOL = {
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
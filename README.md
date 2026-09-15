# GA4 Analysis Agent

A conversational data analysis app over the GA4 e-commerce sample dataset in BigQuery, built around a hand-written agentic loop (no agent framework) that calls the Anthropic API directly.

## Prerequisites

- Node.js
- A Google Cloud account with the BigQuery API enabled
- An Anthropic API key

Note: this project only queries `bigquery-public-data.ga4_obfuscated_sample_ecommerce`, a BigQuery public dataset. The BigQuery sandbox is enough to run it — you do **not** need to enable billing on your GCP project.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Authenticate with Google Cloud:

   ```bash
   gcloud auth application-default login
   ```

   When the browser consent screen opens, make sure to check **all** the requested permissions — if you leave any unchecked, BigQuery queries will fail with a permissions error.

3. Create a `.env` file in the project root with:

   ```
   GCP_PROJECT_ID=your-gcp-project-id
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

   - `GCP_PROJECT_ID` is the **Project ID** shown in the [GCP console](https://console.cloud.google.com/) project selector — not the project _name_, which can differ.
   - `ANTHROPIC_API_KEY` is created at [console.anthropic.com](https://console.anthropic.com/).

## Cost

Running this costs close to nothing: BigQuery usage stays within the free tier (see the sandbox note above), and each conversation with the Anthropic API costs a few cents.

## Running the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Example questions

- "What was total revenue by month?"
- "Which product categories sold the most in December 2020?"
- "Compare conversion rate by device type."
- "What were the top traffic sources by sessions?"

## Dataset range

The GA4 e-commerce sample dataset only covers **November 1, 2020 through January 31, 2021**. Questions about dates outside that range won't return data.

## Project structure

- `src/api/server.ts` — Express app entry point; serves the static frontend from `public/` and mounts the API routes.
- `src/api/routes/` — HTTP routes; `chat.ts` exposes the `POST /api/chat` endpoint that receives a question, keeps per-conversation history in memory, and runs the agent.
- `src/agent/agent.ts` — the agentic loop itself: calls the Anthropic Messages API, dispatches tool calls (`run_query`, `create_chart`), and feeds results back to the model until it produces a final answer.
- `src/agent/prompt.ts` / `src/agent/schema.ts` — the system prompt and the description of the queryable `sessions`/`items` tables (derived from the GA4 events schema).
- `src/agent/tools.ts` / `src/agent/types.ts` — tool definitions given to the model and the shared message/response types.
- `src/connection/bigQuery.ts` — runs SQL against BigQuery with a row cap and a max-bytes-billed safeguard.
- `src/validators/` — validation for generated SQL (date range, and that the statement starts with `SELECT`/`WITH` with no stray semicolons) and for chart specs before they're sent to the frontend.
- `public/` — the frontend: `index.html`, `app.js` (chat UI, calls the API), and `charts.js` (renders the charts returned by the agent).

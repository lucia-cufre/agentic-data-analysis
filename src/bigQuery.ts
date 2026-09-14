import { BigQuery } from "@google-cloud/bigquery";
import "dotenv/config";

const bigQuery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

const MAX_BYTES_BILLED = "5000000000";
//A query returning tens of thousands of rows can blow up the calling agent's context.
const MAX_ROWS = 1000;

export async function executeQuery(sql: string) {
  const [rows] = await bigQuery.query({
    query: sql,
    location: "US",
    maximumBytesBilled: MAX_BYTES_BILLED,
  });

  return {
    rows: rows.slice(0, MAX_ROWS),
    truncated: rows.length > MAX_ROWS,
    totalRows: rows.length,
  };
}

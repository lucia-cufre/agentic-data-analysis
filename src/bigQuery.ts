import { BigQuery } from "@google-cloud/bigquery";
import "dotenv/config";

const bigQuery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

const MAX_BYTES_BILLED = "5000000000";

export async function executeQuery(sql: string) {
  const [rows] = await bigQuery.query({
    query: sql,
    location: "US",
    maximumBytesBilled: MAX_BYTES_BILLED,
  });
  
  return rows;
}

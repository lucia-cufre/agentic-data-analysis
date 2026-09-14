const EVENTS_TABLE =
  "`bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`";

export const SESSIONS_CTE = `SELECT
  PARSE_DATE('%Y%m%d', event_date) AS date,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
  MAX(traffic_source.medium) AS medium,
  MAX(traffic_source.source) AS source,
  MAX(geo.country) AS country,
  MAX(device.category) AS device,
  COUNTIF(event_name = 'page_view') AS page_views,
  MAX(IF(event_name = 'purchase', 1, 0)) AS converted,
  SUM(IF(event_name = 'purchase', ecommerce.purchase_revenue, 0)) AS revenue
FROM ${EVENTS_TABLE}
WHERE _TABLE_SUFFIX BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
GROUP BY date, session_id`;

export const ITEMS_CTE = `SELECT
  PARSE_DATE('%Y%m%d', event_date) AS date,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
  item.item_name AS product_name,
  item.item_category AS product_category,
  item.quantity AS quantity,
  item.item_revenue AS revenue
FROM ${EVENTS_TABLE}
CROSS JOIN UNNEST(items) AS item
WHERE event_name = 'purchase'
AND _TABLE_SUFFIX BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'`;

export const SCHEMA_DESCRIPTION = `You can query two tables: "sessions" and "items". Do not reference any other
table, and do not add your own date filtering — the date range is already applied.

sessions — one row per session per day.
  date              DATE
  session_id        INTEGER, globally unique. Join to items on session_id alone.
  medium            STRING, traffic medium (e.g. "organic", "cpc").
  source            STRING, traffic source (e.g. "google").
  country           STRING
  device            STRING, device category (e.g. "desktop", "mobile").
  page_views        INTEGER, page_view events in the session.
  converted         INTEGER, 1 if the session included a purchase, else 0.
  revenue           NUMERIC, total purchase revenue for the session, 0 if not converted.

A session that crosses midnight appears once per date, so counting rows
overstates sessions by roughly 1%. This is intentional: the grain is
session-day, which is how daily traffic is normally reported.

items — one row per line item of a purchase event. Only converted sessions produce rows here,
so an inner join to sessions drops non-converting sessions; use a left join to keep them.
  date              DATE
  session_id        INTEGER, join key back to sessions.
  product_name      STRING
  product_category  STRING
  quantity          INTEGER
  revenue           NUMERIC, revenue for this line item, total for the line and not a unit price.

Joining sessions to items multiplies session rows by item count, so aggregate items
(e.g. SUM, COUNT) before or while joining if you need session-level totals.

Revenue does not reconcile between the two tables. Some purchases record their
items as "(not set)" with null revenue. Use sessions for total revenue and items
for revenue by product. Never present figures from both as if they were the same
number.

These values look like real data but are not. Do not present them as real
channels, sources or products without saying what they are:
  "<Other>"         Google's bucket for low-frequency values
  "(none)"          no medium recorded, usually direct traffic
  "(direct)"        no referring source
  "(data deleted)"  removed during dataset anonymisation
  "(not set)"       missing value

The dataset covers 2020-11-01 to 2021-01-31. There is no data outside this
range. If asked about another period, say so rather than returning an empty
result.`;

function applyDates(cte: string, startDate: string, endDate: string): string {
  return cte
    .replaceAll("{{START_DATE}}", startDate)
    .replaceAll("{{END_DATE}}", endDate);
}

export function buildQuery(
  sql: string,
  startDate: string,
  endDate: string,
): string {
  const sessionsCte = applyDates(SESSIONS_CTE, startDate, endDate);
  const itemsCte = applyDates(ITEMS_CTE, startDate, endDate);

  return `WITH sessions AS (
${sessionsCte}
), items AS (
${itemsCte}
)
${sql}`;
}

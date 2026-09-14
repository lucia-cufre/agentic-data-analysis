import { ChartType } from "./chart-validation";
import { ValidationResult } from "./validation-type";

const MIN_DATE = "20201101";
const MAX_DATE = "20210131";

const DATE_FORMAT = /^\d{8}$/;

function isRealDate(yyyymmdd: string): boolean {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function validateDateRange(
  startDate: string,
  endDate: string,
): ValidationResult {
  if (!DATE_FORMAT.test(startDate) || !DATE_FORMAT.test(endDate)) {
    return {
      valid: false,
      error: "Dates must be YYYYMMDD (8 digits, no separators).",
    };
  }

  if (!isRealDate(startDate) || !isRealDate(endDate)) {
    return {
      valid: false,
      error: "Dates must be real calendar dates in YYYYMMDD format.",
    };
  }

  // Fixed-width YYYYMMDD strings sort the same way alphabetically and
  // chronologically, so range checks can compare them directly.
  if (startDate < MIN_DATE || endDate > MAX_DATE) {
    return {
      valid: false,
      error: `Dates must be within the dataset range ${MIN_DATE} to ${MAX_DATE}.`,
    };
  }

  if (startDate > endDate) {
    return { valid: false, error: "startDate must not be after endDate." };
  }

  return { valid: true };
}

export function validateSql(sql: string): ValidationResult {
  const trimmed = sql.trim();
  const normalized = trimmed.toUpperCase();

  if (!/^(SELECT|WITH)\b/.test(normalized)) {
    return { valid: false, error: "SQL must start with SELECT or WITH." };
  }

  // Prevents that a semicolon in the middle splits the statement in two since the model's SQL is concatenated after a WITH clause.
  const semicolons = [...trimmed.matchAll(/;/g)];
  const hasStraySemicolon = semicolons.some(
    (match) => match.index !== trimmed.length - 1,
  );
  if (hasStraySemicolon) {
    return {
      valid: false,
      error:
        "SQL must not contain ';' except as a single trailing character at the end of the statement.",
    };
  }

  return { valid: true };
}

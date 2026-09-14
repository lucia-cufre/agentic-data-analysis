import { ValidationResult } from "./validation-type";

export type ChartType = "bar" | "line" | "pie";
const CHART_TYPES: ChartType[] = ["bar", "line", "pie"];

export type ChartSpec = {
  type: ChartType;
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
};

export function validateChartSpec(
  type: ChartType,
  labels: string[],
  series: { name: string; values: number[] }[],
): ValidationResult {
  if (!CHART_TYPES.includes(type)) {
    return {
      valid: false,
      error: `Invalid chart type: ${type}. Must be one of: ${CHART_TYPES.join(", ")}.`,
    };
  }

  if (labels.length === 0) {
    return { valid: false, error: "At least one label is required." };
  }

  if (series.length === 0) {
    return { valid: false, error: "At least one series is required." };
  }

  const mismatched = series.filter((s) => s.values.length !== labels.length);
  if (mismatched.length > 0) {
    return {
      valid: false,
      error:
        `Each series must have the same number of values as labels (${labels.length}). ` +
        `Mismatched series: ${mismatched.map((s) => `"${s.name}" has ${s.values.length} values`).join(", ")}.`,
    };
  }

  return { valid: true };
}

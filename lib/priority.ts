export const PRIORITIES = ["very_high", "high", "med", "low", "very_low"] as const;
export type Priority = typeof PRIORITIES[number];

export const PRIORITY_ORDER: Record<string, number> = {
  very_high: 0,
  high: 1,
  med: 2,
  low: 3,
  very_low: 4,
};

export const PRIORITY_LABELS: Record<string, string> = {
  very_high: "Very high",
  high: "High",
  med: "Medium",
  low: "Low",
  very_low: "Very low",
};

export function isValidPriority(v: unknown): boolean {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}

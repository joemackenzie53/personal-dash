export type EventCategory =
  | "unknown"
  | "holiday"
  | "birthday"
  | "anniversary"
  | "christmas"
  | "easter"
  | "valentines"
  | "travel"
  | "social"
  | "admin";

export function classifyEvent(opts: { title?: string | null; calendarIsHoliday?: boolean; calendarSummary?: string | null }): EventCategory {
  const title = (opts.title || "").toLowerCase();
  const cal = (opts.calendarSummary || "").toLowerCase();

  const holidayLike = opts.calendarIsHoliday || cal.includes("holidays") || cal.includes("holiday");
  if (holidayLike) return "holiday";

  if (/(\bbirthday\b|\bbday\b)/i.test(title)) return "birthday";
  if (/\banniversary\b/i.test(title)) return "anniversary";
  if (/(\bchristmas\b|\bxmas\b)/i.test(title)) return "christmas";
  if (/\beaster\b/i.test(title)) return "easter";
  if (/\bvalentine\b/i.test(title)) return "valentines";

  // lightweight heuristics
  if (/(\bflight\b|\bhotel\b|\btrain\b|\bairport\b|\bairbnb\b)/i.test(title)) return "travel";
  if (/(\bdinner\b|\blunch\b|\bdrinks\b|\bparty\b)/i.test(title)) return "social";

  return "unknown";
}

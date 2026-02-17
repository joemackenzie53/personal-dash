import { getDb } from "@/lib/db";

type CategoryRule = { name: string; pattern: string | null };

let cachedRules: CategoryRule[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

async function loadRules(): Promise<CategoryRule[]> {
  const now = Date.now();
  if (cachedRules && now - cacheTime < CACHE_TTL) return cachedRules;
  const db = await getDb();
  const rows = await db.all<CategoryRule>(
    "SELECT name, pattern FROM categories ORDER BY sort_order ASC, name ASC"
  );
  cachedRules = rows;
  cacheTime = now;
  return rows;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordsToRegex(pattern: string): RegExp | null {
  const keywords = pattern
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keywords.length === 0) return null;
  const parts = keywords.map((k) => `\\b${escapeRegex(k)}\\b`);
  return new RegExp(parts.join("|"), "i");
}

export function invalidateClassifyCache() {
  cachedRules = null;
}

export async function classifyEvent(opts: {
  title?: string | null;
  calendarIsHoliday?: boolean;
  calendarSummary?: string | null;
}): Promise<string> {
  const title = (opts.title || "").toLowerCase();
  const cal = (opts.calendarSummary || "").toLowerCase();
  const calIsHoliday = opts.calendarIsHoliday || false;

  const rules = await loadRules();

  for (const rule of rules) {
    if (!rule.pattern) continue;

    const trimmedPattern = rule.pattern.trim().toLowerCase();
    if (trimmedPattern === "calendar:holidays") {
      if (calIsHoliday || cal.includes("holidays") || cal.includes("holiday")) {
        return rule.name;
      }
      continue;
    }

    try {
      const regex = keywordsToRegex(rule.pattern);
      if (regex && regex.test(title)) return rule.name;
    } catch {
    }
  }

  return "unknown";
}

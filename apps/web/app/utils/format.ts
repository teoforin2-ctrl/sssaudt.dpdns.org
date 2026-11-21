/** Public-site formatting helpers (UI v2). */

const EMPTY = new Set(["", "—", "-", "–", "null", "undefined", "n/a", "na"]);

function isEmptyish(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "number") return !Number.isFinite(v) || v === 0;
  const s = String(v).trim().toLowerCase();
  return !s || EMPTY.has(s);
}

/** Normalize wager to `×30`. Returns null for empty/zero. */
export function formatWager(v: unknown): string | null {
  if (isEmptyish(v)) return null;
  const raw = String(v).trim();
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const pretty = Number.isInteger(n) ? String(n) : String(n);
  return `×${pretty}`;
}

/** Wager tone for colored badges. */
export function wagerTone(v: unknown): "good" | "mid" | "high" | null {
  const formatted = formatWager(v);
  if (!formatted) return null;
  const n = Number(formatted.replace("×", "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n <= 30) return "good";
  if (n <= 40) return "mid";
  return "high";
}

/** Money with non-breaking thin space as thousands separator. */
export function formatMoney(v: unknown, currency?: string | null): string | null {
  if (isEmptyish(v)) return null;
  const raw = String(v).trim();
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return raw;
  const num = Number(m[0]!.replace(",", "."));
  if (!Number.isFinite(num)) return raw;
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  })
    .format(num)
    .replace(/\u00a0/g, "\u202f");
  const cur = currency?.trim();
  return cur ? `${formatted}\u202f${cur}` : formatted;
}

/** Join meta parts with ` · `, dropping empties. */
export function joinMeta(parts: Array<string | null | undefined | false>): string {
  return parts
    .map((p) => (p == null || p === false ? "" : String(p).trim()))
    .filter((p) => p && !EMPTY.has(p.toLowerCase()))
    .join(" · ");
}

type PluralForms = { one: string; few: string; many: string; other?: string };

/** RU/EN pluralization via Intl.PluralRules. */
export function plural(
  n: number,
  forms: PluralForms | [string, string, string],
  locale: string = "ru",
): string {
  const abs = Math.abs(Math.trunc(n));
  const f: PluralForms = Array.isArray(forms)
    ? { one: forms[0]!, few: forms[1]!, many: forms[2]!, other: forms[2] }
    : forms;
  const cat = new Intl.PluralRules(locale.startsWith("en") ? "en" : "ru").select(abs);
  if (locale.startsWith("en")) {
    return abs === 1 ? f.one : (f.other || f.many);
  }
  if (cat === "one") return f.one;
  if (cat === "few") return f.few;
  return f.many;
}

export function relativeTime(date: string | Date | null | undefined, locale = "ru"): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith("en") ? "en" : "ru", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  const min = Math.round(diffSec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 48) return rtf.format(hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return rtf.format(day, "day");
  const mo = Math.round(day / 30);
  if (Math.abs(mo) < 12) return rtf.format(mo, "month");
  return rtf.format(Math.round(mo / 12), "year");
}

export function formatDate(date: string | Date | null | undefined, locale = "ru"): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale.startsWith("en") ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Date + time label: «21 нояб. 2026, 18:15» / «21 Nov 2026, 18:15». */
export function formatDateTime(date: string | Date | null | undefined, locale = "ru"): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale.startsWith("en") ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Strip seed/review junk like `(Pokerdom, #2423)` and `[3c04d6bc]`. */
export function sanitizeReviewText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\s*\([^)]*,\s*#\d+\)\s*$/g, "")
    .replace(/\s*\[[0-9a-f]{6,12}\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Deterministic hue from string (for logo/cover fallbacks). */
export function hashHue(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

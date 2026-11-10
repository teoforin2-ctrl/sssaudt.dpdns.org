export function forumTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function forumParagraphs(md: string): string[] {
  return md
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function forumInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1] ?? "";
  return (first[0]! + (second[0] ?? "")).toUpperCase();
}

export function forumAgo(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  const en = locale.startsWith("en");
  if (min < 1) return en ? "just now" : "только что";
  if (min < 60) return en ? `${min} min ago` : `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return en ? `${h} h ago` : `${h} ч назад`;
  const d = Math.floor(h / 24);
  return en ? `${d} d ago` : `${d} дн. назад`;
}

export function forumFmt(n: number, locale: string): string {
  return n.toLocaleString(locale.startsWith("en") ? "en-GB" : "ru-RU");
}

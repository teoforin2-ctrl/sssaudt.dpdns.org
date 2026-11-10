export type SearchEntityType = "casino" | "slot" | "bonus" | "article";

export type SearchCandidate = {
  type: SearchEntityType;
  slug: string;
  title: string;
  description?: string | null;
  href: string;
};

export type RankedSearchHit = SearchCandidate & { score: number };

/** Higher score = better match. Exact title prefix > substring > description. */
export function scoreSearchMatch(
  query: string,
  title: string,
  description?: string | null,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = title.toLowerCase();
  if (t === q) return 120;
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 70;
  const d = (description || "").toLowerCase();
  if (d.includes(q)) return 40;
  return 0;
}

export function rankSearchHits(
  query: string,
  candidates: SearchCandidate[],
  limitPerType = 4,
): RankedSearchHit[] {
  const scored = candidates
    .map((c) => ({
      ...c,
      score: scoreSearchMatch(query, c.title, c.description),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const counts: Record<string, number> = {};
  const out: RankedSearchHit[] = [];
  for (const hit of scored) {
    const n = counts[hit.type] || 0;
    if (n >= limitPerType) continue;
    counts[hit.type] = n + 1;
    out.push(hit);
  }
  return out;
}

export function readingMinutesFromChars(chars: number): number {
  return Math.max(1, Math.round(chars / 900));
}

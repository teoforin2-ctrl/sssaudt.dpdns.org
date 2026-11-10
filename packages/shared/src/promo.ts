/** Honest promo countdown: only when remaining time is in (0, 48h]. */
export function getPromoCountdown(
  validUntil: Date | string | null | undefined,
  now: Date = new Date(),
): { kind: "countdown"; ms: number } | { kind: "until"; date: Date } | null {
  if (!validUntil) return null;
  const end = validUntil instanceof Date ? validUntil : new Date(validUntil);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return null;
  const hours48 = 48 * 60 * 60 * 1000;
  if (ms < hours48) return { kind: "countdown", ms };
  return { kind: "until", date: end };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

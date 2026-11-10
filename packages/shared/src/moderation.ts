import { hasReviewKeyword } from "./keywords.js";

export const REVIEW_MIN_CHARS = 250;
export const REVIEW_JACCARD_THRESHOLD = 0.55;
export const REVIEW_SHINGLE_SIZE = 5;

const JAILBREAK_RE =
  /ignore\s+previous\s+instructions|system\s+prompt|оцени\s+как|you\s+are\s+(now\s+)?chatgpt|act\s+as\s+an?\s+ai/i;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/;
const LONG_SPECIAL_RE = /[^\p{L}\p{N}\s.,!?;:'"()\-]{8,}/u;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(tokens: string[], size = REVIEW_SHINGLE_SIZE): Set<string> {
  const out = new Set<string>();
  if (tokens.length < size) {
    if (tokens.length) out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i <= tokens.length - size; i++) {
    out.add(tokens.slice(i, i + size).join(" "));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function sentenceChunks(text: string): string[] {
  return text
    .split(/[.!?…\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 12);
}

export type ModerationOk = { ok: true; qualityScore: number };
export type ModerationFail = { ok: false; reasons: string[] };
export type ModerationResult = ModerationOk | ModerationFail;

/** Rule-based mock moderation. Tone is ignored. */
export function moderateReviewText(body: string, existingBodies: string[] = []): ModerationResult {
  const reasons: string[] = [];
  const trimmed = body.trim();

  if (trimmed.length < REVIEW_MIN_CHARS) {
    reasons.push("too_short");
  }
  if (JAILBREAK_RE.test(trimmed) || ZERO_WIDTH_RE.test(trimmed) || LONG_SPECIAL_RE.test(trimmed)) {
    reasons.push("bypass_attempt");
  }

  const tokens = tokenize(trimmed);
  const uniqueRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const avgLen = tokens.length ? tokens.reduce((s, w) => s + w.length, 0) / tokens.length : 0;
  if (tokens.length < 30 || uniqueRatio < 0.35 || avgLen < 2.2) {
    reasons.push("low_coherence");
  }

  const chunks = sentenceChunks(trimmed);
  const seen = new Set<string>();
  let repeats = 0;
  for (const c of chunks) {
    if (seen.has(c)) repeats++;
    seen.add(c);
  }
  if (repeats >= 2 || (chunks.length >= 3 && repeats / chunks.length >= 0.4)) {
    reasons.push("artificial_repeats");
  }

  if (!hasReviewKeyword(trimmed)) {
    reasons.push("missing_keyword");
    reasons.push("off_topic");
  }

  const mine = shingles(tokens);
  for (const other of existingBodies) {
    const score = jaccard(mine, shingles(tokenize(other)));
    if (score >= REVIEW_JACCARD_THRESHOLD) {
      reasons.push("not_unique");
      break;
    }
  }

  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] };

  const concrete = Math.min(60, Math.round(tokens.length / 4));
  const info = Math.min(25, Math.round(uniqueRatio * 25));
  const kw = 10;
  const coh = Math.min(5, Math.round(avgLen));
  const qualityScore = Math.max(1, Math.min(100, concrete + info + kw + coh));
  return { ok: true, qualityScore };
}

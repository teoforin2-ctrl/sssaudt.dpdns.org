export type ArticleFields = {
  title: string;
  excerpt: string;
  body_md: string;
};

export function uniqueArticlePrompt(input: ArticleFields, locale: string): string {
  return [
    `You rewrite casino/iGaming editorial content for locale "${locale}".`,
    "Goals: make the text unique (paraphrase), keep meaning, facts, structure, and tone.",
    "Do NOT invent licenses, RTP, bonuses, payouts, or guarantees of winning.",
    "Keep markdown structure if present. Keep neutral, responsible-gambling friendly language.",
    "Return STRICT JSON with keys: title, excerpt, body_md.",
    "",
    "INPUT JSON:",
    JSON.stringify(input),
  ].join("\n");
}

export function translateArticlePrompt(
  input: ArticleFields,
  fromLocale: string,
  toLocale: string,
): string {
  return [
    `Translate the following editorial JSON from "${fromLocale}" to "${toLocale}".`,
    "Preserve meaning, facts, and markdown. Do not add marketing promises or invented data.",
    "Return STRICT JSON with keys: title, excerpt, body_md.",
    "",
    "INPUT JSON:",
    JSON.stringify(input),
  ].join("\n");
}

export function parseArticleJson(raw: string): ArticleFields {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const data = JSON.parse(cleaned) as Partial<ArticleFields>;
  const title = String(data.title || "").trim();
  const excerpt = String(data.excerpt || "").trim();
  const body_md = String(data.body_md || "").trim();
  if (!title) throw new Error("ai_missing_title");
  return { title, excerpt, body_md };
}

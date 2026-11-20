import type { Pool } from "pg";
import { chatCompletion, recordUsage } from "./openai.js";
import {
  parseArticleJson,
  translateArticlePrompt,
  uniqueArticlePrompt,
  type ArticleFields,
} from "./prompts.js";
import { loadAiSettings, resolveApiKey, todayTokenTotal } from "./settings.js";

type ArticleRow = {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  excerpt_ru: string | null;
  excerpt_en: string | null;
  body_md_ru: string | null;
  body_md_en: string | null;
};

function fieldsFor(row: ArticleRow, locale: string): ArticleFields {
  const loc = locale === "en" ? "en" : "ru";
  return {
    title: String((loc === "en" ? row.title_en : row.title_ru) || "").trim(),
    excerpt: String((loc === "en" ? row.excerpt_en : row.excerpt_ru) || "").trim(),
    body_md: String((loc === "en" ? row.body_md_en : row.body_md_ru) || "").trim(),
  };
}

function pickSourceLocale(row: ArticleRow, preferred: string[]): string {
  for (const loc of preferred) {
    const f = fieldsFor(row, loc);
    if (f.title || f.body_md) return loc === "en" ? "en" : "ru";
  }
  if (fieldsFor(row, "en").title || fieldsFor(row, "en").body_md) return "en";
  return "ru";
}

export type ProcessArticleResult = {
  articleId: string;
  slug: string;
  sourceLocale: string;
  targetLocales: string[];
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  updated: Record<string, boolean>;
};

export async function processArticle(
  pool: Pool,
  opts: {
    articleId: string;
    sourceLocale?: string | null;
    targetLocales?: string[];
    actions?: Array<"unique" | "translate">;
  },
): Promise<ProcessArticleResult> {
  const settings = await loadAiSettings(pool);
  if (settings && settings.enabled === false) {
    throw new Error("ai_disabled");
  }

  const apiKey = await resolveApiKey(pool);
  if (!apiKey) throw new Error("openai_api_key_missing");

  const model = settings?.model || "gpt-4o-mini";
  const limit = settings?.daily_token_limit ?? null;
  if (limit != null && limit > 0) {
    const used = await todayTokenTotal(pool);
    if (used >= limit) throw new Error("daily_token_limit_reached");
  }

  const { rows } = await pool.query<ArticleRow>(`select * from articles where id = $1`, [
    opts.articleId,
  ]);
  const row = rows[0];
  if (!row) throw new Error("article_not_found");

  const sourceLocale =
    (opts.sourceLocale && (opts.sourceLocale === "en" ? "en" : "ru")) ||
    pickSourceLocale(row, settings?.source_locales || ["en"]);

  const targetsRaw =
    opts.targetLocales?.length
      ? opts.targetLocales
      : settings?.target_locales?.length
        ? settings.target_locales
        : sourceLocale === "en"
          ? ["ru"]
          : ["en"];
  const targetLocales = [...new Set(targetsRaw.map((l) => (l === "en" ? "en" : "ru")))].filter(
    (l) => l !== sourceLocale,
  );

  const actions = opts.actions?.length ? opts.actions : (["unique", "translate"] as const);
  let promptTokens = 0;
  let completionTokens = 0;
  const updated: Record<string, boolean> = {};

  let sourceFields = fieldsFor(row, sourceLocale);
  if (!sourceFields.title && !sourceFields.body_md) {
    throw new Error("article_empty_source");
  }

  if (actions.includes("unique")) {
    const chat = await chatCompletion({
      apiKey,
      model,
      responseJson: true,
      messages: [
        {
          role: "system",
          content:
            "You are an editorial rewriter for a responsible iGaming review site. Output valid JSON only.",
        },
        { role: "user", content: uniqueArticlePrompt(sourceFields, sourceLocale) },
      ],
    });
    sourceFields = parseArticleJson(chat.content);
    promptTokens += chat.promptTokens;
    completionTokens += chat.completionTokens;
    await recordUsage(pool, {
      contentType: "article",
      action: "unique",
      promptTokens: chat.promptTokens,
      completionTokens: chat.completionTokens,
      totalTokens: chat.totalTokens,
    });
    updated[`unique_${sourceLocale}`] = true;
  }

  const translations: Record<string, ArticleFields> = {};
  if (actions.includes("translate")) {
    for (const to of targetLocales) {
      const chat = await chatCompletion({
        apiKey,
        model,
        responseJson: true,
        messages: [
          {
            role: "system",
            content:
              "You are a precise translator for a responsible iGaming review site. Output valid JSON only.",
          },
          {
            role: "user",
            content: translateArticlePrompt(sourceFields, sourceLocale, to),
          },
        ],
      });
      translations[to] = parseArticleJson(chat.content);
      promptTokens += chat.promptTokens;
      completionTokens += chat.completionTokens;
      await recordUsage(pool, {
        contentType: "article",
        action: "translate",
        promptTokens: chat.promptTokens,
        completionTokens: chat.completionTokens,
        totalTokens: chat.totalTokens,
      });
      updated[`translate_${to}`] = true;
    }
  }

  const patch: Record<string, string | null> = {};
  if (sourceLocale === "en") {
    patch.title_en = sourceFields.title;
    patch.excerpt_en = sourceFields.excerpt || null;
    patch.body_md_en = sourceFields.body_md || null;
  } else {
    patch.title_ru = sourceFields.title;
    patch.excerpt_ru = sourceFields.excerpt || null;
    patch.body_md_ru = sourceFields.body_md || null;
  }
  for (const [loc, fields] of Object.entries(translations)) {
    if (loc === "en") {
      patch.title_en = fields.title;
      patch.excerpt_en = fields.excerpt || null;
      patch.body_md_en = fields.body_md || null;
    } else {
      patch.title_ru = fields.title;
      patch.excerpt_ru = fields.excerpt || null;
      patch.body_md_ru = fields.body_md || null;
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [col, val] of Object.entries(patch)) {
    values.push(val);
    sets.push(`${col} = $${values.length}`);
  }
  values.push(sourceLocale, model, row.id);
  sets.push(`ai_source_locale = $${values.length - 2}`);
  sets.push(`ai_model = $${values.length - 1}`);
  sets.push(`ai_processed_at = now()`);
  sets.push(`updated_at = now()`);

  await pool.query(
    `update articles set ${sets.join(", ")} where id = $${values.length}`,
    values,
  );

  return {
    articleId: row.id,
    slug: row.slug,
    sourceLocale,
    targetLocales,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    updated,
  };
}

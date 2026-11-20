import type { Pool } from "pg";
import { chatCompletion, recordUsage } from "./openai.js";
import { loadAiSettings, resolveApiKey, todayTokenTotal } from "./settings.js";

export type TextPair = {
  short?: string;
  body: string;
};

function parsePairJson(raw: string): TextPair {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const data = JSON.parse(cleaned) as Partial<TextPair & { short_desc?: string; description?: string }>;
  const short = String(data.short ?? data.short_desc ?? "").trim();
  const body = String(data.body ?? data.description ?? "").trim();
  if (!body && !short) throw new Error("ai_empty_entity_text");
  return { short: short || undefined, body };
}

function uniquePrompt(kind: string, input: TextPair, locale: string): string {
  return [
    `You rewrite ${kind} editorial copy for an iGaming review site (locale "${locale}").`,
    "Paraphrase to make unique; keep meaning and known facts. Do NOT invent licenses, RTP, bonuses, or payout claims.",
    "Return STRICT JSON with keys: short (optional short blurb), body (main description). Preserve markdown if present.",
    "",
    "INPUT JSON:",
    JSON.stringify(input),
  ].join("\n");
}

function translatePrompt(kind: string, input: TextPair, from: string, to: string): string {
  return [
    `Translate this ${kind} editorial JSON from "${from}" to "${to}".`,
    "Do not invent facts. Return STRICT JSON with keys: short, body.",
    "",
    "INPUT JSON:",
    JSON.stringify(input),
  ].join("\n");
}

export type EntityProcessResult = {
  entityId: string;
  slug: string;
  contentType: string;
  sourceLocale: string;
  targetLocales: string[];
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type EntityConfig = {
  contentType: "casino" | "slot" | "forum_category";
  table: string;
  shortRu?: string;
  shortEn?: string;
  bodyRu: string;
  bodyEn: string;
  slugCol?: string;
};

const CONFIGS: Record<string, EntityConfig> = {
  casino: {
    contentType: "casino",
    table: "casinos",
    shortRu: "short_desc_ru",
    shortEn: "short_desc_en",
    bodyRu: "description_ru",
    bodyEn: "description_en",
  },
  slot: {
    contentType: "slot",
    table: "slots",
    bodyRu: "description_ru",
    bodyEn: "description_en",
  },
  forum_category: {
    contentType: "forum_category",
    table: "forum_categories",
    bodyRu: "description_ru",
    bodyEn: "description_en",
  },
};

function fieldsFromRow(cfg: EntityConfig, row: Record<string, unknown>, locale: string): TextPair {
  const loc = locale === "en" ? "en" : "ru";
  const shortCol = loc === "en" ? cfg.shortEn : cfg.shortRu;
  const bodyCol = loc === "en" ? cfg.bodyEn : cfg.bodyRu;
  return {
    short: shortCol ? String(row[shortCol] || "").trim() || undefined : undefined,
    body: String(row[bodyCol] || "").trim(),
  };
}

export async function processEntity(
  pool: Pool,
  opts: {
    contentType: "casino" | "slot" | "forum_category";
    entityId: string;
    sourceLocale?: string | null;
    targetLocales?: string[];
    actions?: Array<"unique" | "translate">;
  },
): Promise<EntityProcessResult> {
  const cfg = CONFIGS[opts.contentType];
  if (!cfg) throw new Error("unsupported_entity");

  const settings = await loadAiSettings(pool);
  if (settings && settings.enabled === false) throw new Error("ai_disabled");

  const apiKey = await resolveApiKey(pool);
  if (!apiKey) throw new Error("openai_api_key_missing");

  const model = settings?.model || "gpt-4o-mini";
  const limit = settings?.daily_token_limit ?? null;
  if (limit != null && limit > 0) {
    const used = await todayTokenTotal(pool);
    if (used >= limit) throw new Error("daily_token_limit_reached");
  }

  const { rows } = await pool.query(`select * from ${cfg.table} where id = $1`, [opts.entityId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("entity_not_found");

  const preferred = settings?.source_locales || ["en"];
  let sourceLocale =
    (opts.sourceLocale && (opts.sourceLocale === "en" ? "en" : "ru")) || null;
  if (!sourceLocale) {
    for (const loc of preferred) {
      const f = fieldsFromRow(cfg, row, loc);
      if (f.body || f.short) {
        sourceLocale = loc === "en" ? "en" : "ru";
        break;
      }
    }
  }
  sourceLocale = sourceLocale || (fieldsFromRow(cfg, row, "en").body ? "en" : "ru");

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
  let sourceFields = fieldsFromRow(cfg, row, sourceLocale);
  if (!sourceFields.body && !sourceFields.short) throw new Error("entity_empty_source");

  if (actions.includes("unique")) {
    const chat = await chatCompletion({
      apiKey,
      model,
      responseJson: true,
      messages: [
        {
          role: "system",
          content: "You are an editorial rewriter for a responsible iGaming review site. Output valid JSON only.",
        },
        { role: "user", content: uniquePrompt(opts.contentType, sourceFields, sourceLocale) },
      ],
    });
    sourceFields = parsePairJson(chat.content);
    promptTokens += chat.promptTokens;
    completionTokens += chat.completionTokens;
    await recordUsage(pool, {
      contentType: opts.contentType,
      action: "unique",
      promptTokens: chat.promptTokens,
      completionTokens: chat.completionTokens,
      totalTokens: chat.totalTokens,
    });
  }

  const translations: Record<string, TextPair> = {};
  if (actions.includes("translate")) {
    for (const to of targetLocales) {
      const chat = await chatCompletion({
        apiKey,
        model,
        responseJson: true,
        messages: [
          {
            role: "system",
            content: "You are a precise translator for a responsible iGaming review site. Output valid JSON only.",
          },
          { role: "user", content: translatePrompt(opts.contentType, sourceFields, sourceLocale, to) },
        ],
      });
      translations[to] = parsePairJson(chat.content);
      promptTokens += chat.promptTokens;
      completionTokens += chat.completionTokens;
      await recordUsage(pool, {
        contentType: opts.contentType,
        action: "translate",
        promptTokens: chat.promptTokens,
        completionTokens: chat.completionTokens,
        totalTokens: chat.totalTokens,
      });
    }
  }

  const patch: Record<string, string | null> = {};
  const apply = (loc: string, fields: TextPair) => {
    if (loc === "en") {
      if (cfg.shortEn) patch[cfg.shortEn] = fields.short || null;
      patch[cfg.bodyEn] = fields.body || null;
    } else {
      if (cfg.shortRu) patch[cfg.shortRu] = fields.short || null;
      patch[cfg.bodyRu] = fields.body || null;
    }
  };
  apply(sourceLocale, sourceFields);
  for (const [loc, fields] of Object.entries(translations)) apply(loc, fields);

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [col, val] of Object.entries(patch)) {
    values.push(val);
    sets.push(`${col} = $${values.length}`);
  }
  values.push(sourceLocale, model, opts.entityId);
  sets.push(`ai_source_locale = $${values.length - 2}`);
  sets.push(`ai_model = $${values.length - 1}`);
  sets.push(`ai_processed_at = now()`);
  if (cfg.table === "casinos") sets.push(`updated_at = now()`);

  await pool.query(
    `update ${cfg.table} set ${sets.join(", ")} where id = $${values.length}`,
    values,
  );

  return {
    entityId: opts.entityId,
    slug: String(row.slug || ""),
    contentType: opts.contentType,
    sourceLocale,
    targetLocales,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

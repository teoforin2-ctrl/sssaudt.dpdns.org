import type { Pool } from "pg";
import { decryptSecret, encryptSecret, keyHint } from "./crypto.js";

export type AiSettingsRow = {
  id: number;
  openai_api_key_enc: string | null;
  openai_api_key_hint: string | null;
  model: string;
  source_locales: string[];
  target_locales: string[];
  auto_process: boolean;
  auto_publish?: boolean;
  daily_token_limit: number | null;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type AiSettingsPublic = {
  model: string;
  sourceLocales: string[];
  targetLocales: string[];
  autoProcess: boolean;
  autoPublish: boolean;
  dailyTokenLimit: number | null;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  updatedAt: string | null;
};

export function mapSettingsPublic(row: AiSettingsRow | null | undefined): AiSettingsPublic {
  const envKey = (process.env.OPENAI_API_KEY || "").trim();
  const hasDb = Boolean(row?.openai_api_key_enc);
  const hasEnv = Boolean(envKey);
  return {
    model: row?.model || "gpt-4o-mini",
    sourceLocales: row?.source_locales?.length ? row.source_locales : ["en"],
    targetLocales: row?.target_locales?.length ? row.target_locales : ["ru"],
    autoProcess: Boolean(row?.auto_process),
    autoPublish: Boolean(row?.auto_publish),
    dailyTokenLimit: row?.daily_token_limit ?? null,
    enabled: row?.enabled !== false,
    hasApiKey: hasDb || hasEnv,
    apiKeyHint: hasDb
      ? row?.openai_api_key_hint || "••••"
      : hasEnv
        ? keyHint(envKey)
        : null,
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
  };
}

export async function loadAiSettings(pool: Pool): Promise<AiSettingsRow | null> {
  const { rows } = await pool.query<AiSettingsRow>(`select * from ai_settings where id = 1`);
  return rows[0] || null;
}

/** Resolve plaintext API key: DB encrypted first, then OPENAI_API_KEY env. */
export async function resolveApiKey(pool: Pool): Promise<string | null> {
  const row = await loadAiSettings(pool);
  if (row?.openai_api_key_enc) {
    try {
      return decryptSecret(row.openai_api_key_enc);
    } catch {
      /* fall through to env */
    }
  }
  const envKey = (process.env.OPENAI_API_KEY || "").trim();
  return envKey || null;
}

export async function saveApiKey(pool: Pool, plain: string, userId: string | null) {
  const enc = encryptSecret(plain.trim());
  const hint = keyHint(plain);
  await pool.query(
    `
    update ai_settings set
      openai_api_key_enc = $1,
      openai_api_key_hint = $2,
      updated_at = now(),
      updated_by = $3
    where id = 1
    `,
    [enc, hint, userId],
  );
}

export async function clearApiKey(pool: Pool, userId: string | null) {
  await pool.query(
    `
    update ai_settings set
      openai_api_key_enc = null,
      openai_api_key_hint = null,
      updated_at = now(),
      updated_by = $1
    where id = 1
    `,
    [userId],
  );
}

export async function todayTokenTotal(pool: Pool): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query<{ total_tokens: string }>(
    `select total_tokens::text from ai_usage_daily where day = $1::date and content_type = 'all' and action = 'all'`,
    [day],
  );
  return Number(rows[0]?.total_tokens ?? 0);
}

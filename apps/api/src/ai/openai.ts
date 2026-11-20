import type { Pool } from "pg";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export async function chatCompletion(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  responseJson?: boolean;
}): Promise<ChatResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.4,
      messages: opts.messages,
      ...(opts.responseJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const raw = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  if (!res.ok) {
    throw new Error(raw.error?.message || `openai_http_${res.status}`);
  }

  const content = raw.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("openai_empty_response");

  const promptTokens = Number(raw.usage?.prompt_tokens ?? 0);
  const completionTokens = Number(raw.usage?.completion_tokens ?? 0);
  return {
    content,
    model: raw.model || opts.model,
    promptTokens,
    completionTokens,
    totalTokens: Number(raw.usage?.total_tokens ?? promptTokens + completionTokens),
  };
}

export async function recordUsage(
  pool: Pool,
  opts: {
    contentType: string;
    action: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  },
) {
  const day = new Date().toISOString().slice(0, 10);
  const pairs: Array<[string, string]> = [
    [opts.contentType, opts.action],
    [opts.contentType, "all"],
    ["all", opts.action],
    ["all", "all"],
  ];
  for (const [contentType, action] of pairs) {
    await pool.query(
      `
      insert into ai_usage_daily (day, content_type, action, prompt_tokens, completion_tokens, total_tokens, requests)
      values ($1::date, $2, $3, $4, $5, $6, 1)
      on conflict (day, content_type, action) do update set
        prompt_tokens = ai_usage_daily.prompt_tokens + excluded.prompt_tokens,
        completion_tokens = ai_usage_daily.completion_tokens + excluded.completion_tokens,
        total_tokens = ai_usage_daily.total_tokens + excluded.total_tokens,
        requests = ai_usage_daily.requests + 1
      `,
      [day, contentType, action, opts.promptTokens, opts.completionTokens, opts.totalTokens],
    );
  }
}

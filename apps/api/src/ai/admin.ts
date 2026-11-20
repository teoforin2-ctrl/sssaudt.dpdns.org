import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import {
  clearApiKey,
  loadAiSettings,
  mapSettingsPublic,
  saveApiKey,
  todayTokenTotal,
} from "./settings.js";
import { tickAiWorker } from "./worker.js";

function pageParams(query: unknown) {
  const q = query as { page?: string; limit?: string; q?: string; status?: string };
  const page = Math.max(1, Number(q.page || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit || 20) || 20));
  return { page, limit, offset: (page - 1) * limit, q: (q.q || "").trim(), status: q.status };
}

export async function registerAiAdmin(app: FastifyInstance, pool: Pool) {
  app.get("/v1/admin/ai/settings", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const row = await loadAiSettings(pool);
    const todayTokens = await todayTokenTotal(pool).catch(() => 0);
    return { settings: mapSettingsPublic(row), todayTokens };
  });

  app.patch("/v1/admin/ai/settings", async (req, reply) => {
    const user = requireAdmin(req, reply);
    if (!user) return;

    const body = z
      .object({
        model: z.string().min(1).max(120).optional(),
        sourceLocales: z.array(z.string().min(2).max(8)).min(1).max(8).optional(),
        targetLocales: z.array(z.string().min(2).max(8)).min(1).max(8).optional(),
        autoProcess: z.boolean().optional(),
        autoPublish: z.boolean().optional(),
        dailyTokenLimit: z.number().int().positive().nullable().optional(),
        enabled: z.boolean().optional(),
        apiKey: z.string().min(8).max(500).nullable().optional(),
      })
      .parse(req.body || {});

    if (body.apiKey === null) {
      await clearApiKey(pool, user.id);
    } else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
      await saveApiKey(pool, body.apiKey.trim(), user.id);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.model !== undefined) {
      values.push(body.model.trim());
      sets.push(`model = $${values.length}`);
    }
    if (body.sourceLocales !== undefined) {
      values.push(body.sourceLocales.map((l) => l.toLowerCase()));
      sets.push(`source_locales = $${values.length}`);
    }
    if (body.targetLocales !== undefined) {
      values.push(body.targetLocales.map((l) => l.toLowerCase()));
      sets.push(`target_locales = $${values.length}`);
    }
    if (body.autoProcess !== undefined) {
      values.push(body.autoProcess);
      sets.push(`auto_process = $${values.length}`);
    }
    if (body.autoPublish !== undefined) {
      values.push(body.autoPublish);
      sets.push(`auto_publish = $${values.length}`);
    }
    if (body.dailyTokenLimit !== undefined) {
      values.push(body.dailyTokenLimit);
      sets.push(`daily_token_limit = $${values.length}`);
    }
    if (body.enabled !== undefined) {
      values.push(body.enabled);
      sets.push(`enabled = $${values.length}`);
    }

    if (sets.length) {
      values.push(user.id);
      sets.push(`updated_by = $${values.length}`);
      sets.push(`updated_at = now()`);
      await pool.query(`update ai_settings set ${sets.join(", ")} where id = 1`, values);
    }

    const row = await loadAiSettings(pool);
    const todayTokens = await todayTokenTotal(pool).catch(() => 0);
    return { settings: mapSettingsPublic(row), todayTokens };
  });

  app.get("/v1/admin/ai/usage", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = req.query as {
      from?: string;
      to?: string;
      contentType?: string;
      action?: string;
    };
    const to = (q.to || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const fromDefault = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const from = (q.from || fromDefault).slice(0, 10);
    const contentType = (q.contentType || "all").trim() || "all";
    const action = (q.action || "all").trim() || "all";

    const { rows: daily } = await pool.query(
      `
      select day::text, content_type, action, prompt_tokens, completion_tokens, total_tokens, requests
      from ai_usage_daily
      where day between $1::date and $2::date
        and content_type = $3
        and action = $4
      order by day asc
      `,
      [from, to, contentType, action],
    );

    const { rows: breakdown } = await pool.query(
      `
      select content_type, action,
             sum(prompt_tokens)::bigint as prompt_tokens,
             sum(completion_tokens)::bigint as completion_tokens,
             sum(total_tokens)::bigint as total_tokens,
             sum(requests)::int as requests
      from ai_usage_daily
      where day between $1::date and $2::date
        and not (content_type = 'all' and action = 'all')
      group by content_type, action
      order by sum(total_tokens) desc
      `,
      [from, to],
    );

    const totals = daily.reduce(
      (acc, r) => {
        acc.promptTokens += Number(r.prompt_tokens || 0);
        acc.completionTokens += Number(r.completion_tokens || 0);
        acc.totalTokens += Number(r.total_tokens || 0);
        acc.requests += Number(r.requests || 0);
        return acc;
      },
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 },
    );

    return {
      from,
      to,
      contentType,
      action,
      totals,
      daily: daily.map((r) => ({
        day: r.day,
        promptTokens: Number(r.prompt_tokens || 0),
        completionTokens: Number(r.completion_tokens || 0),
        totalTokens: Number(r.total_tokens || 0),
        requests: Number(r.requests || 0),
      })),
      breakdown: breakdown.map((r) => ({
        contentType: r.content_type,
        action: r.action,
        promptTokens: Number(r.prompt_tokens || 0),
        completionTokens: Number(r.completion_tokens || 0),
        totalTokens: Number(r.total_tokens || 0),
        requests: Number(r.requests || 0),
      })),
    };
  });

  app.get("/v1/admin/ai/jobs", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { page, limit, offset, status } = pageParams(req.query);
    const params: unknown[] = [];
    const where: string[] = ["true"];
    if (status && ["pending", "processing", "done", "failed", "cancelled"].includes(status)) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.join(" and ");
    params.push(limit, offset);
    const [{ rows: countRows }, { rows }] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from ai_jobs where ${whereSql}`,
        params.slice(0, -2),
      ),
      pool.query(
        `
        select id, content_type, content_id, content_slug, action, status,
               source_locale, target_locales, error, attempts, max_attempts,
               prompt_tokens, completion_tokens, total_tokens, model,
               created_at, started_at, finished_at
        from ai_jobs
        where ${whereSql}
        order by created_at desc
        limit $${params.length - 1} offset $${params.length}
        `,
        params,
      ),
    ]);
    return {
      items: rows,
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
    };
  });

  app.post("/v1/admin/ai/jobs", async (req, reply) => {
    const user = requireAdmin(req, reply);
    if (!user) return;

    const body = z
      .object({
        contentType: z
          .enum(["article", "casino", "slot", "forum_category"])
          .default("article"),
        contentId: z.string().uuid(),
        action: z.enum(["process", "unique", "translate"]).default("process"),
        sourceLocale: z.string().min(2).max(8).nullable().optional(),
        targetLocales: z.array(z.string().min(2).max(8)).optional(),
      })
      .parse(req.body || {});

    const tableByType: Record<string, string> = {
      article: "articles",
      casino: "casinos",
      slot: "slots",
      forum_category: "forum_categories",
    };
    const table = tableByType[body.contentType];
    const { rows: ents } = await pool.query<{ id: string; slug: string }>(
      `select id, slug from ${table} where id = $1`,
      [body.contentId],
    );
    if (!ents[0]) return reply.code(404).send({ error: `${body.contentType}_not_found` });

    const settings = await loadAiSettings(pool);
    const targets =
      body.targetLocales?.length
        ? body.targetLocales
        : settings?.target_locales || ["ru"];

    const payloadActions =
      body.action === "unique"
        ? ["unique"]
        : body.action === "translate"
          ? ["translate"]
          : ["unique", "translate"];

    const { rows } = await pool.query(
      `
      insert into ai_jobs (
        content_type, content_id, content_slug, action, status,
        source_locale, target_locales, payload, created_by
      ) values (
        $1, $2, $3, 'process', 'pending',
        $4, $5, $6::jsonb, $7
      )
      returning *
      `,
      [
        body.contentType,
        body.contentId,
        ents[0].slug,
        body.sourceLocale || null,
        targets,
        JSON.stringify({ actions: payloadActions }),
        user.id,
      ],
    );

    // kick worker promptly
    void tickAiWorker(pool);

    return { item: rows[0] };
  });

  app.post("/v1/admin/ai/jobs/:id/retry", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      update ai_jobs set
        status = 'pending',
        error = null,
        finished_at = null,
        started_at = null
      where id = $1 and status in ('failed', 'cancelled')
      returning *
      `,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    void tickAiWorker(pool);
    return { item: rows[0] };
  });

  app.post("/v1/admin/ai/jobs/:id/cancel", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      update ai_jobs set
        status = 'cancelled',
        finished_at = now()
      where id = $1 and status in ('pending', 'processing')
      returning *
      `,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.get("/v1/admin/ai/overview", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const row = await loadAiSettings(pool);
    const todayTokens = await todayTokenTotal(pool).catch(() => 0);
    const { rows: jobCounts } = await pool.query<{ status: string; n: string }>(`
      select status, count(*)::text as n from ai_jobs group by status
    `);
    const { rows: aiArts } = await pool.query<{ n: string }>(`
      select count(*)::text as n from articles where ai_processed_at is not null
    `);
    return {
      settings: mapSettingsPublic(row),
      todayTokens,
      jobsByStatus: Object.fromEntries(jobCounts.map((r) => [r.status, Number(r.n)])),
      articlesAiProcessed: Number(aiArts[0]?.n ?? 0),
    };
  });
}

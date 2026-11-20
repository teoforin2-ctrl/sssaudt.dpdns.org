import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { promoteStagingItem } from "./promote-staging.js";
import { tickAiWorker } from "./worker.js";

const CONTENT_TYPES = ["article", "casino", "slot", "forum"] as const;
const PROCESS_STATUSES = [
  "new",
  "queued",
  "processing",
  "ai_done",
  "published",
  "done",
  "error",
  "rejected",
] as const;

function pageParams(query: unknown) {
  const q = query as Record<string, string | undefined>;
  const page = Math.max(1, Number(q.page || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit || 20) || 20));
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    q: (q.q || "").trim(),
    contentType: (q.contentType || "").trim(),
    source: (q.source || "").trim(),
    processStatus: (q.processStatus || "").trim(),
    aiStatus: (q.aiStatus || "").trim(),
    published: (q.published || "").trim(),
  };
}

function mapItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    contentType: row.content_type,
    sourceId: row.source_id,
    sourceCode: row.source_code,
    sourceName: row.source_name ?? null,
    sourceUrl: row.source_url,
    sourceLocale: row.source_locale,
    externalId: row.external_id,
    title: row.title,
    body: row.body,
    payload: row.payload,
    processStatus: row.process_status,
    aiStatus: row.ai_status,
    aiJobId: row.ai_job_id,
    aiProcessedAt: row.ai_processed_at,
    published: Boolean(row.published),
    publishedAt: row.published_at,
    liveId: row.live_id,
    liveSlug: row.live_slug,
    error: row.error,
    scrapedAt: row.scraped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function registerParserAdmin(app: FastifyInstance, pool: Pool) {
  app.get("/v1/admin/parser/overview", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const [{ rows: byStatus }, { rows: byType }, { rows: bySource }, { rows: totals }] =
      await Promise.all([
        pool.query<{ process_status: string; n: string }>(`
          select process_status, count(*)::text as n
          from ai_staging
          group by process_status
        `),
        pool.query<{ content_type: string; n: string }>(`
          select content_type, count(*)::text as n
          from ai_staging
          group by content_type
          order by count(*) desc
        `),
        pool.query<{ source_code: string; n: string }>(`
          select coalesce(nullif(source_code, ''), 'unknown') as source_code, count(*)::text as n
          from ai_staging
          group by 1
          order by count(*) desc
        `),
        pool.query<{
          total: string
          published: string
          ai_done: string
          new_count: string
          errors: string
        }>(`
          select
            count(*)::text as total,
            count(*) filter (where published = true)::text as published,
            count(*) filter (where ai_status = 'done' or process_status in ('ai_done','published','done'))::text as ai_done,
            count(*) filter (where process_status = 'new')::text as new_count,
            count(*) filter (where process_status = 'error' or ai_status = 'error')::text as errors
          from ai_staging
        `),
      ]);

    const t = totals[0];
    return {
      totals: {
        total: Number(t?.total ?? 0),
        published: Number(t?.published ?? 0),
        aiDone: Number(t?.ai_done ?? 0),
        new: Number(t?.new_count ?? 0),
        errors: Number(t?.errors ?? 0),
      },
      byStatus: byStatus.map((r) => ({ status: r.process_status, count: Number(r.n) })),
      byType: byType.map((r) => ({ contentType: r.content_type, count: Number(r.n) })),
      bySource: bySource.map((r) => ({ sourceCode: r.source_code, count: Number(r.n) })),
    };
  });

  app.get("/v1/admin/parser/sources", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { rows } = await pool.query(`
      select s.*,
             (select count(*)::int from ai_staging st where st.source_id = s.id or st.source_code = s.code) as items_count
      from parser_sources s
      order by s.enabled desc, s.name asc
    `);
    return {
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        baseUrl: r.base_url,
        contentTypes: r.content_types || [],
        enabled: r.enabled,
        notes: r.notes,
        meta: r.meta,
        itemsCount: Number(r.items_count || 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  });

  app.post("/v1/admin/parser/sources", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = z
      .object({
        code: z.string().min(2).max(80).regex(/^[a-z0-9_]+$/),
        name: z.string().min(1).max(200),
        baseUrl: z.string().url().nullable().optional(),
        contentTypes: z.array(z.enum(CONTENT_TYPES)).default([]),
        enabled: z.boolean().default(true),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(req.body || {});

    try {
      const { rows } = await pool.query(
        `
        insert into parser_sources (code, name, base_url, content_types, enabled, notes)
        values ($1, $2, $3, $4, $5, $6)
        returning *
        `,
        [
          body.code,
          body.name,
          body.baseUrl ?? null,
          body.contentTypes,
          body.enabled,
          body.notes ?? null,
        ],
      );
      return { item: rows[0] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("parser_sources_code_key")) {
        return reply.code(409).send({ error: "source_code_exists" });
      }
      throw err;
    }
  });

  app.patch("/v1/admin/parser/sources/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        baseUrl: z.string().url().nullable().optional(),
        contentTypes: z.array(z.enum(CONTENT_TYPES)).optional(),
        enabled: z.boolean().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(req.body || {});

    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) {
      values.push(body.name);
      sets.push(`name = $${values.length}`);
    }
    if (body.baseUrl !== undefined) {
      values.push(body.baseUrl);
      sets.push(`base_url = $${values.length}`);
    }
    if (body.contentTypes !== undefined) {
      values.push(body.contentTypes);
      sets.push(`content_types = $${values.length}`);
    }
    if (body.enabled !== undefined) {
      values.push(body.enabled);
      sets.push(`enabled = $${values.length}`);
    }
    if (body.notes !== undefined) {
      values.push(body.notes);
      sets.push(`notes = $${values.length}`);
    }
    if (!sets.length) return reply.code(400).send({ error: "empty_patch" });
    sets.push(`updated_at = now()`);
    values.push(id);
    const { rows } = await pool.query(
      `update parser_sources set ${sets.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.get("/v1/admin/parser/items", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const p = pageParams(req.query);
    const params: unknown[] = [];
    const where: string[] = ["true"];

    if (p.q) {
      params.push(`%${p.q}%`);
      where.push(
        `(st.title ilike $${params.length} or st.source_url ilike $${params.length} or st.external_id ilike $${params.length} or st.live_slug ilike $${params.length})`,
      );
    }
    if (p.contentType && CONTENT_TYPES.includes(p.contentType as (typeof CONTENT_TYPES)[number])) {
      params.push(p.contentType);
      where.push(`st.content_type = $${params.length}`);
    }
    if (p.source) {
      params.push(p.source);
      where.push(`(st.source_code = $${params.length} or ps.code = $${params.length})`);
    }
    if (p.processStatus && PROCESS_STATUSES.includes(p.processStatus as (typeof PROCESS_STATUSES)[number])) {
      params.push(p.processStatus);
      where.push(`st.process_status = $${params.length}`);
    }
    if (p.aiStatus && ["none", "queued", "processing", "done", "error"].includes(p.aiStatus)) {
      params.push(p.aiStatus);
      where.push(`st.ai_status = $${params.length}`);
    }
    if (p.published === "1" || p.published === "true") {
      where.push(`st.published = true`);
    } else if (p.published === "0" || p.published === "false") {
      where.push(`st.published = false`);
    }

    const whereSql = where.join(" and ");
    params.push(p.limit, p.offset);

    const [{ rows: countRows }, { rows }] = await Promise.all([
      pool.query<{ n: string }>(
        `
        select count(*)::text as n
        from ai_staging st
        left join parser_sources ps on ps.id = st.source_id
        where ${whereSql}
        `,
        params.slice(0, -2),
      ),
      pool.query(
        `
        select st.*, ps.name as source_name
        from ai_staging st
        left join parser_sources ps on ps.id = st.source_id
        where ${whereSql}
        order by st.scraped_at desc nulls last, st.created_at desc
        limit $${params.length - 1} offset $${params.length}
        `,
        params,
      ),
    ]);

    return {
      items: rows.map((r) => mapItem(r as Record<string, unknown>)),
      total: Number(countRows[0]?.n ?? 0),
      page: p.page,
      limit: p.limit,
    };
  });

  app.get("/v1/admin/parser/items/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      select st.*, ps.name as source_name
      from ai_staging st
      left join parser_sources ps on ps.id = st.source_id
      where st.id = $1
      `,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: mapItem(rows[0] as Record<string, unknown>) };
  });

  /** Ingest parsed entity into staging (dedupe by dedupe_key or type+source+url). */
  app.post("/v1/admin/parser/ingest", async (req, reply) => {
    const user = requireAdmin(req, reply);
    if (!user) return;

    const body = z
      .object({
        contentType: z.enum(CONTENT_TYPES),
        sourceCode: z.string().min(1).max(80).default("manual"),
        sourceUrl: z.string().url().nullable().optional(),
        sourceLocale: z.string().min(2).max(8).nullable().optional(),
        externalId: z.string().max(200).nullable().optional(),
        title: z.string().max(1000).nullable().optional(),
        body: z.string().max(500000).nullable().optional(),
        payload: z.record(z.unknown()).optional(),
        dedupeKey: z.string().max(500).nullable().optional(),
      })
      .parse(req.body || {});

    let sourceId: string | null = null;
    const { rows: srcRows } = await pool.query<{ id: string }>(
      `select id from parser_sources where code = $1`,
      [body.sourceCode],
    );
    if (srcRows[0]) {
      sourceId = srcRows[0].id;
    } else {
      const { rows: created } = await pool.query<{ id: string }>(
        `
        insert into parser_sources (code, name, content_types)
        values ($1, $2, $3)
        on conflict (code) do update set updated_at = now()
        returning id
        `,
        [body.sourceCode, body.sourceCode, [body.contentType]],
      );
      sourceId = created[0]?.id || null;
    }

    const dedupe =
      body.dedupeKey ||
      [body.contentType, body.sourceCode, body.externalId || body.sourceUrl || body.title || ""]
        .filter(Boolean)
        .join("::");

    const { rows } = await pool.query(
      `
      insert into ai_staging (
        content_type, source_id, source_code, source_url, source_locale,
        external_id, dedupe_key, title, body, payload, process_status, scraped_at
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10::jsonb, 'new', now()
      )
      on conflict (dedupe_key) where (dedupe_key is not null) do update set
        title = excluded.title,
        body = excluded.body,
        payload = excluded.payload,
        source_url = coalesce(excluded.source_url, ai_staging.source_url),
        source_locale = coalesce(excluded.source_locale, ai_staging.source_locale),
        updated_at = now(),
        scraped_at = now()
      returning *
      `,
      [
        body.contentType,
        sourceId,
        body.sourceCode,
        body.sourceUrl ?? null,
        body.sourceLocale ?? null,
        body.externalId ?? null,
        dedupe || null,
        body.title ?? null,
        body.body ?? null,
        JSON.stringify(body.payload || {}),
      ],
    );

    return { item: mapItem(rows[0] as Record<string, unknown>) };
  });

  app.post("/v1/admin/parser/items/:id/queue-ai", async (req, reply) => {
    const user = requireAdmin(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({ autoPublish: z.boolean().optional() })
      .parse(req.body || {});

    try {
      const promoted = await promoteStagingItem(pool, {
        stagingId: id,
        autoPublish: body.autoPublish,
        createdBy: user.id,
      });
      void tickAiWorker(pool);
      return { item: promoted };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "queue_failed";
      if (msg === "staging_not_found") return reply.code(404).send({ error: msg });
      if (msg === "item_rejected") return reply.code(400).send({ error: msg });
      return reply.code(400).send({ error: msg });
    }
  });

  /** Queue all staging `new` items through AI (optionally auto-publish). */
  app.post("/v1/admin/parser/queue-all", async (req, reply) => {
    const user = requireAdmin(req, reply);
    if (!user) return;
    const body = z
      .object({
        autoPublish: z.boolean().default(true),
        limit: z.number().int().min(1).max(50).default(20),
        contentType: z.enum(["article", "casino", "slot", "forum"]).optional(),
      })
      .parse(req.body || {});

    const params: unknown[] = [];
    const where = [
      `process_status in ('new', 'error', 'ai_done')`,
      `ai_status in ('none', 'error', 'done')`,
      `process_status not in ('queued', 'processing', 'rejected')`,
    ];
    if (body.contentType) {
      params.push(body.contentType);
      where.push(`content_type = $${params.length}`);
    }
    params.push(body.limit);
    const { rows } = await pool.query<{ id: string }>(
      `
      select id from ai_staging
      where ${where.join(" and ")}
      order by scraped_at asc
      limit $${params.length}
      `,
      params,
    );

    const results: Array<{ id: string; ok: boolean; error?: string; liveSlug?: string }> = [];
    for (const row of rows) {
      try {
        const promoted = await promoteStagingItem(pool, {
          stagingId: row.id,
          autoPublish: body.autoPublish,
          createdBy: user.id,
        });
        results.push({ id: row.id, ok: true, liveSlug: promoted.liveSlug });
      } catch (err) {
        results.push({
          id: row.id,
          ok: false,
          error: err instanceof Error ? err.message : "error",
        });
      }
    }
    void tickAiWorker(pool);
    return {
      queued: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      autoPublish: body.autoPublish,
      results,
    };
  });

  app.post("/v1/admin/parser/items/:id/reject", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      update ai_staging set
        process_status = 'rejected',
        updated_at = now()
      where id = $1
      returning *
      `,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: mapItem(rows[0] as Record<string, unknown>) };
  });

  /** Hard-delete staging row only (does not delete live article/casino/slot). */
  app.delete("/v1/admin/parser/items/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      delete from ai_staging
      where id = $1
        and process_status <> 'processing'
        and ai_status <> 'processing'
      returning id, title, content_type
      `,
      [id],
    );
    if (!rows[0]) {
      const { rows: exists } = await pool.query(
        `select id, process_status, ai_status from ai_staging where id = $1`,
        [id],
      );
      if (!exists[0]) return reply.code(404).send({ error: "not_found" });
      return reply.code(409).send({ error: "cannot_delete_while_processing" });
    }
    return { ok: true, item: rows[0] };
  });

  app.post("/v1/admin/parser/items/:id/mark-published", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        liveId: z.string().uuid().optional(),
        liveSlug: z.string().max(200).optional(),
        published: z.boolean().default(true),
      })
      .parse(req.body || {});

    const { rows } = await pool.query(
      `
      update ai_staging set
        published = $2,
        published_at = case when $2 then now() else null end,
        process_status = case when $2 then 'published' else process_status end,
        live_id = coalesce($3, live_id),
        live_slug = coalesce($4, live_slug),
        updated_at = now()
      where id = $1
      returning *
      `,
      [id, body.published, body.liveId ?? null, body.liveSlug ?? null],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: mapItem(rows[0] as Record<string, unknown>) };
  });
}

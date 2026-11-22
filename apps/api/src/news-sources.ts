import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin } from "./auth.js";

type SourceRow = {
  id: number;
  name: string;
  kind: string;
  url: string | null;
  path: string | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

function mapSource(r: SourceRow) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    url: r.url,
    path: r.path,
    priority: r.priority,
    enabled: r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/** Fetch a feed URL server-side and report item count + sample titles. */
async function checkFeed(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false as const, httpStatus: res.status, error: `HTTP ${res.status}` };
    const text = await res.text();
    const items = (text.match(/<item[\s>]/gi) || []).length;
    const entries = (text.match(/<entry[\s>]/gi) || []).length;
    const count = items || entries;
    const titles = [...text.matchAll(/<(?:title)>(?:<!\[CDATA\[)?([\s\S]{5,200}?)(?:\]\])?<\/(?:title)>/gi)]
      .map((m) => m[1].trim())
      .filter((t) => t && !/^\s*(rss|atom|feed)/i.test(t))
      .slice(0, 5);
    const looksLikeFeed = /<(?:rss|feed|rdf)[\s>]/i.test(text.slice(0, 2000));
    if (!looksLikeFeed) {
      return { ok: false as const, httpStatus: res.status, error: "not_a_feed (нет <rss>/<feed> в начале документа)" };
    }
    return { ok: true as const, httpStatus: res.status, items: count, sampleTitles: titles };
  }
  catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message.slice(0, 200) : "fetch_failed",
    };
  }
}

export async function registerNewsSources(app: FastifyInstance, pool: Pool) {
  app.get("/v1/admin/news-sources", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { rows } = await pool.query<SourceRow>(
      `select * from news_sources order by enabled desc, priority desc, id`,
    );
    return { items: rows.map(mapSource) };
  });

  app.post("/v1/admin/news-sources", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = z
      .object({
        name: z.string().min(1).max(120),
        kind: z.enum(["rss", "csv"]).default("rss"),
        url: z.string().url().max(500).optional(),
        path: z.string().max(300).optional(),
        priority: z.number().int().min(1).max(9).default(5),
      })
      .parse(req.body || {});
    if (body.kind === "rss" && !body.url) return reply.code(400).send({ error: "url_required" });
    if (body.kind === "csv" && !body.path) return reply.code(400).send({ error: "path_required" });
    try {
      const { rows } = await pool.query<SourceRow>(
        `insert into news_sources (name, kind, url, path, priority) values ($1,$2,$3,$4,$5) returning *`,
        [body.name, body.kind, body.url ?? null, body.path ?? null, body.priority],
      );
      return { item: mapSource(rows[0]!) };
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("news_sources_name_key")) return reply.code(409).send({ error: "name_exists" });
      throw err;
    }
  });

  app.patch("/v1/admin/news-sources/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    if (!/^\d+$/.test(id)) return reply.code(400).send({ error: "invalid_id" });
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        url: z.string().url().max(500).optional(),
        path: z.string().max(300).optional(),
        priority: z.number().int().min(1).max(9).optional(),
        enabled: z.boolean().optional(),
      })
      .parse(req.body || {});
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [col, val] of [
      ["name", body.name],
      ["url", body.url],
      ["path", body.path],
      ["priority", body.priority],
      ["enabled", body.enabled],
    ] as const) {
      if (val !== undefined) {
        values.push(val);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (!sets.length) return reply.code(400).send({ error: "empty_patch" });
    sets.push(`updated_at = now()`);
    values.push(Number(id));
    const { rows } = await pool.query<SourceRow>(
      `update news_sources set ${sets.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: mapSource(rows[0]) };
  });

  app.delete("/v1/admin/news-sources/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    if (!/^\d+$/.test(id)) return reply.code(400).send({ error: "invalid_id" });
    const { rows } = await pool.query(
      `delete from news_sources where id = $1 returning id, name`,
      [Number(id)],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { ok: true, deleted: rows[0] };
  });

  app.post("/v1/admin/news-sources/:id/check", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    if (!/^\d+$/.test(id)) return reply.code(400).send({ error: "invalid_id" });
    const { rows } = await pool.query<SourceRow>(`select * from news_sources where id = $1`, [Number(id)]);
    const src = rows[0];
    if (!src) return reply.code(404).send({ error: "not_found" });
    if (src.kind !== "rss" || !src.url) {
      return { ok: false, error: "csv-источник проверяется запуском newsbot (файл на диске сервера)" };
    }
    const result = await checkFeed(src.url);
    await pool.query(
      `update news_sources set last_check_at = now(), last_check_ok = $2, last_check_items = $3, last_check_error = $4, updated_at = now() where id = $1`,
      [
        src.id,
        result.ok,
        result.ok ? result.items : null,
        result.ok ? null : result.error,
      ],
    );
    return result;
  });

  /** Прямая проверка URL без сохранения (кнопка «Проверить» в форме добавления). */
  app.post("/v1/admin/news-sources/check-url", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = z.object({ url: z.string().url().max(500) }).parse(req.body || {});
    return checkFeed(body.url);
  });
}

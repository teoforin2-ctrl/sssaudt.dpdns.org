import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireStaff } from "./auth.js";

function langOf(req: FastifyRequest) {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  return locale.startsWith("en") ? "en" : "ru";
}

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(3).max(200),
  projectType: z.enum(["white-label", "custom", "aggregator", "other"]).default("white-label"),
  budget: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  locale: z.string().trim().max(8).optional(),
});

const packagePatchSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  title_ru: z.string().trim().min(1).max(120).optional(),
  title_en: z.string().trim().min(1).max(120).optional(),
  price_label_ru: z.string().trim().max(80).nullable().optional(),
  price_label_en: z.string().trim().max(80).nullable().optional(),
  features_ru: z.array(z.string()).optional(),
  features_en: z.array(z.string()).optional(),
  highlight: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  published: z.boolean().optional(),
});

const casePatchSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  title_ru: z.string().trim().min(1).max(120).optional(),
  title_en: z.string().trim().min(1).max(120).optional(),
  summary_ru: z.string().trim().max(500).nullable().optional(),
  summary_en: z.string().trim().max(500).nullable().optional(),
  metrics_ru: z.array(z.string()).optional(),
  metrics_en: z.array(z.string()).optional(),
  cover_url: z.string().trim().max(500).nullable().optional(),
  sort_order: z.number().int().optional(),
  published: z.boolean().optional(),
});

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

export async function registerB2b(app: FastifyInstance, pool: Pool) {
  app.get("/v1/b2b", async (req) => {
    const lang = langOf(req);
    try {
      const [packages, cases] = await Promise.all([
        pool.query(
          `
          select id, slug, title_ru, title_en, price_label_ru, price_label_en,
                 features_ru, features_en, highlight, sort_order
          from b2b_packages
          where published = true
          order by sort_order asc, created_at asc
          `,
        ),
        pool.query(
          `
          select id, slug, title_ru, title_en, summary_ru, summary_en,
                 metrics_ru, metrics_en, cover_url, sort_order
          from b2b_cases
          where published = true
          order by sort_order asc, created_at asc
          `,
        ),
      ]);

      return {
        locale: lang,
        packages: packages.rows.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: lang === "en" ? p.title_en : p.title_ru,
          priceLabel: lang === "en" ? p.price_label_en : p.price_label_ru,
          features: asStringList(lang === "en" ? p.features_en : p.features_ru),
          highlight: Boolean(p.highlight),
        })),
        cases: cases.rows.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: lang === "en" ? c.title_en : c.title_ru,
          summary: lang === "en" ? c.summary_en : c.summary_ru,
          metrics: asStringList(lang === "en" ? c.metrics_en : c.metrics_ru),
          coverUrl: c.cover_url,
        })),
      };
    } catch (err) {
      app.log.error({ err }, "b2b public failed");
      return { locale: lang, packages: [], cases: [] };
    }
  });

  app.post("/v1/b2b/leads", async (req, reply) => {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const locale = (body.locale || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
    try {
      const { rows } = await pool.query(
        `
        insert into b2b_leads (name, contact, project_type, budget, message, locale)
        values ($1, $2, $3, $4, $5, $6)
        returning id, created_at
        `,
        [
          body.name,
          body.contact,
          body.projectType,
          body.budget || null,
          body.message || null,
          locale,
        ],
      );
      return { ok: true, id: rows[0].id, createdAt: rows[0].created_at };
    } catch (err) {
      app.log.error({ err }, "b2b lead create failed");
      return reply.code(500).send({ error: "lead_failed" });
    }
  });

  app.get("/v1/admin/b2b/packages", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { rows } = await pool.query(
      `select * from b2b_packages order by sort_order asc, created_at asc`,
    );
    return { items: rows };
  });

  app.post("/v1/admin/b2b/packages", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const parsed = packagePatchSchema
      .extend({
        slug: z.string().trim().min(2).max(80),
        title_ru: z.string().trim().min(1).max(120),
        title_en: z.string().trim().min(1).max(120),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload" });
    }
    const b = parsed.data;
    const { rows } = await pool.query(
      `
      insert into b2b_packages (
        slug, title_ru, title_en, price_label_ru, price_label_en,
        features_ru, features_en, highlight, sort_order, published
      ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
      returning *
      `,
      [
        b.slug,
        b.title_ru,
        b.title_en,
        b.price_label_ru ?? null,
        b.price_label_en ?? null,
        JSON.stringify(b.features_ru || []),
        JSON.stringify(b.features_en || []),
        b.highlight ?? false,
        b.sort_order ?? 0,
        b.published ?? true,
      ],
    );
    return { item: rows[0] };
  });

  app.patch("/v1/admin/b2b/packages/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const parsed = packagePatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
    const b = parsed.data;
    const { rows } = await pool.query(
      `
      update b2b_packages set
        slug = coalesce($2, slug),
        title_ru = coalesce($3, title_ru),
        title_en = coalesce($4, title_en),
        price_label_ru = case when $5::boolean then $6 else price_label_ru end,
        price_label_en = case when $7::boolean then $8 else price_label_en end,
        features_ru = coalesce($9::jsonb, features_ru),
        features_en = coalesce($10::jsonb, features_en),
        highlight = coalesce($11, highlight),
        sort_order = coalesce($12, sort_order),
        published = coalesce($13, published),
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        id,
        b.slug ?? null,
        b.title_ru ?? null,
        b.title_en ?? null,
        b.price_label_ru !== undefined,
        b.price_label_ru ?? null,
        b.price_label_en !== undefined,
        b.price_label_en ?? null,
        b.features_ru ? JSON.stringify(b.features_ru) : null,
        b.features_en ? JSON.stringify(b.features_en) : null,
        b.highlight ?? null,
        b.sort_order ?? null,
        b.published ?? null,
      ],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.delete("/v1/admin/b2b/packages/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const { rowCount } = await pool.query(`delete from b2b_packages where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.get("/v1/admin/b2b/cases", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { rows } = await pool.query(
      `select * from b2b_cases order by sort_order asc, created_at asc`,
    );
    return { items: rows };
  });

  app.post("/v1/admin/b2b/cases", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const parsed = casePatchSchema
      .extend({
        slug: z.string().trim().min(2).max(80),
        title_ru: z.string().trim().min(1).max(120),
        title_en: z.string().trim().min(1).max(120),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
    const b = parsed.data;
    const { rows } = await pool.query(
      `
      insert into b2b_cases (
        slug, title_ru, title_en, summary_ru, summary_en,
        metrics_ru, metrics_en, cover_url, sort_order, published
      ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
      returning *
      `,
      [
        b.slug,
        b.title_ru,
        b.title_en,
        b.summary_ru ?? null,
        b.summary_en ?? null,
        JSON.stringify(b.metrics_ru || []),
        JSON.stringify(b.metrics_en || []),
        b.cover_url ?? null,
        b.sort_order ?? 0,
        b.published ?? true,
      ],
    );
    return { item: rows[0] };
  });

  app.patch("/v1/admin/b2b/cases/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const parsed = casePatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
    const b = parsed.data;
    const { rows } = await pool.query(
      `
      update b2b_cases set
        slug = coalesce($2, slug),
        title_ru = coalesce($3, title_ru),
        title_en = coalesce($4, title_en),
        summary_ru = case when $5::boolean then $6 else summary_ru end,
        summary_en = case when $7::boolean then $8 else summary_en end,
        metrics_ru = coalesce($9::jsonb, metrics_ru),
        metrics_en = coalesce($10::jsonb, metrics_en),
        cover_url = case when $11::boolean then $12 else cover_url end,
        sort_order = coalesce($13, sort_order),
        published = coalesce($14, published),
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        id,
        b.slug ?? null,
        b.title_ru ?? null,
        b.title_en ?? null,
        b.summary_ru !== undefined,
        b.summary_ru ?? null,
        b.summary_en !== undefined,
        b.summary_en ?? null,
        b.metrics_ru ? JSON.stringify(b.metrics_ru) : null,
        b.metrics_en ? JSON.stringify(b.metrics_en) : null,
        b.cover_url !== undefined,
        b.cover_url ?? null,
        b.sort_order ?? null,
        b.published ?? null,
      ],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.delete("/v1/admin/b2b/cases/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const { rowCount } = await pool.query(`delete from b2b_cases where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.get("/v1/admin/b2b/leads", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const q = (req.query || {}) as { status?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
    const offset = (page - 1) * limit;
    const status = (q.status || "").trim();
    const params: unknown[] = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `where status = $${params.length}`;
    }
    const countRes = await pool.query<{ n: string }>(
      `select count(*)::text as n from b2b_leads ${where}`,
      params,
    );
    params.push(limit, offset);
    const { rows } = await pool.query(
      `
      select * from b2b_leads
      ${where}
      order by created_at desc
      limit $${params.length - 1} offset $${params.length}
      `,
      params,
    );
    return {
      items: rows,
      total: Number(countRes.rows[0]?.n || 0),
      page,
      limit,
    };
  });

  app.patch("/v1/admin/b2b/leads/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const parsed = z
      .object({ status: z.enum(["new", "in_progress", "done", "spam"]) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
    const { rows } = await pool.query(
      `
      update b2b_leads set status = $2, updated_at = now()
      where id = $1
      returning *
      `,
      [id, parsed.data.status],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });
}

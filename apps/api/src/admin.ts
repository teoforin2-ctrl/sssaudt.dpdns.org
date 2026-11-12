import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { decodeStoredText } from "@x-reviewer/shared";
import { requireStaff, requireAdmin, isAdminRole } from "./auth.js";
import { bumpCasinoCache } from "./cache.js";
import { parseImageDataUrl, saveRasterAsWebp } from "./images.js";
import { recalcCasinoRatings } from "./reviews.js";
import { grantReviewApprovedXp } from "./gamification.js";
import { collectServerStats } from "./server-stats.js";
import { entitySeoSchema, normalizeEntitySeo } from "./entity-seo.js";
import { runSeoPipeline } from "./seo-pipeline.js";
import { shouldValidatePublish, validateEntitySeo } from "./seo-validate.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_UPLOADS =
  process.env.WEB_UPLOADS_DIR ||
  // apps/api/{src,dist} → apps/web/public/uploads/articles
  path.resolve(__dirname, "../../web/public/uploads/articles");
const WEB_CONTENT_UPLOADS =
  process.env.WEB_CONTENT_UPLOADS_DIR ||
  path.resolve(__dirname, "../../web/public/uploads/content");

function pageParams(query: unknown) {
  const q = (query ?? {}) as { page?: string; limit?: string; q?: string; status?: string; role?: string };
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const offset = (page - 1) * limit;
  return {
    page,
    limit,
    offset,
    q: (q.q || "").trim(),
    status: (q.status || "").trim(),
    role: (q.role || "").trim(),
  };
}

async function saveArticleCover(articleId: string, dataUrl: string): Promise<string | null> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed || parsed.ext === "svg") return null;
  if (parsed.buf.length > 5_000_000) return null;
  try {
    return await saveRasterAsWebp({
      dir: WEB_UPLOADS,
      basename: articleId,
      buf: parsed.buf,
      publicPathPrefix: "/uploads/articles",
    });
  } catch {
    return null;
  }
}

async function saveContentImage(dataUrl: string, folder = "content"): Promise<string | null> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed || parsed.ext === "svg") return null;
  if (parsed.buf.length > 5_000_000) return null;
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "") || "content";
  const dir =
    safeFolder === "articles"
      ? WEB_UPLOADS
      : path.join(path.dirname(WEB_CONTENT_UPLOADS), safeFolder);
  const basename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    return await saveRasterAsWebp({
      dir,
      basename,
      buf: parsed.buf,
      publicPathPrefix: `/uploads/${safeFolder}`,
    });
  } catch {
    return null;
  }
}

export async function registerAdmin(app: FastifyInstance, pool: Pool, redis: Redis) {
  /** Inline images for Markdown editors (articles / casino reviews). */
  app.post("/v1/admin/uploads/images", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        data_url: z.string().min(32).max(8_000_000),
        folder: z.enum(["content", "articles", "casinos"]).optional(),
        alt: z.string().max(200).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const url = await saveContentImage(body.data.data_url, body.data.folder || "content");
    if (!url) return reply.code(400).send({ error: "invalid_image" });
    return {
      url,
      alt: body.data.alt || null,
    };
  });

  app.get("/v1/admin/stats", async (req, reply) => {
    if (!requireStaff(req, reply)) return;

    const counts = async (sql: string, params: unknown[] = []) => {
      try {
        const { rows } = await pool.query<{ n: string }>(sql, params);
        return Number(rows[0]?.n ?? 0);
      } catch {
        return 0;
      }
    };

    const days = Math.min(90, Math.max(7, Number((req.query as { days?: string }).days) || 30));

    const [
      casinos,
      casinosPublished,
      bonuses,
      bonusesPublished,
      reviewsPending,
      reviewsApproved,
      reviewsDisplayTotal,
      articles,
      articlesPublished,
      slots,
      slotsPublished,
      banners,
      bannersActive,
      users,
      complaintsOpen,
      clicks7d,
      clicksPrev7d,
      reviews7d,
      reviewsPrev7d,
    ] = await Promise.all([
      counts(`select count(*)::text as n from casinos`),
      counts(`select count(*)::text as n from casinos where status = 'published'`),
      counts(`select count(*)::text as n from bonuses`),
      counts(`select count(*)::text as n from bonuses where published = true and status = 'active'`),
      counts(`select count(*)::text as n from reviews where status = 'pending'`),
      counts(`select count(*)::text as n from reviews where status = 'approved'`),
      counts(`
        select coalesce(sum(
          greatest(
            coalesce((
              select count(*)::int from reviews rv
              where rv.casino_id = c.id and rv.status = 'approved'
            ), 0),
            coalesce(nullif(trim(c.info_json->>'reviewsDisplay'), '')::int, 0)
          )
        ), 0)::text as n
        from casinos c
        where c.status = 'published'
      `),
      counts(`select count(*)::text as n from articles`),
      counts(`select count(*)::text as n from articles where status = 'published'`),
      counts(`select count(*)::text as n from slots`),
      counts(`select count(*)::text as n from slots where status = 'published'`),
      counts(`select count(*)::text as n from banners`),
      counts(`select count(*)::text as n from banners where active = true`),
      counts(`select count(*)::text as n from users`),
      counts(`select count(*)::text as n from complaints where status in ('new','in_review','need_info')`),
      counts(`select count(*)::text as n from go_clicks where created_at >= now() - interval '7 days'`),
      counts(`select count(*)::text as n from go_clicks where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'`),
      counts(`select count(*)::text as n from reviews where created_at >= now() - interval '7 days'`),
      counts(`select count(*)::text as n from reviews where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'`),
    ]);

    let series: { date: string, clicks: number, reviews: number }[] = [];
    try {
      const { rows } = await pool.query<{ day: string, clicks: string, reviews: string }>(
        `
        with days as (
          select generate_series(
            (current_date - ($1::int - 1))::timestamp,
            current_date::timestamp,
            interval '1 day'
          )::date as day
        ),
        clicks as (
          select date_trunc('day', created_at)::date as day, count(*)::int as n
          from go_clicks
          where created_at >= current_date - ($1::int - 1)
          group by 1
        ),
        revs as (
          select date_trunc('day', created_at)::date as day, count(*)::int as n
          from reviews
          where created_at >= current_date - ($1::int - 1)
          group by 1
        )
        select to_char(d.day, 'YYYY-MM-DD') as day,
               coalesce(c.n, 0)::text as clicks,
               coalesce(r.n, 0)::text as reviews
        from days d
        left join clicks c on c.day = d.day
        left join revs r on r.day = d.day
        order by d.day
        `,
        [days],
      );
      series = rows.map((r) => ({
        date: r.day,
        clicks: Number(r.clicks || 0),
        reviews: Number(r.reviews || 0),
      }));
    } catch {
      series = [];
    }

    let topCasinos: { id: string, name: string, slug: string, clicks: number }[] = [];
    try {
      const { rows } = await pool.query(
        `
        select c.id, c.name, c.slug, count(*)::int as clicks
        from go_clicks g
        join casinos c on c.id = coalesce(
          g.casino_id,
          (select id from casinos where slug = g.casino_slug limit 1)
        )
        where g.created_at >= now() - make_interval(days => $1::int)
        group by c.id, c.name, c.slug
        order by clicks desc
        limit 6
        `,
        [days],
      );
      topCasinos = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        slug: r.slug as string,
        clicks: Number(r.clicks || 0),
      }));
    } catch {
      topCasinos = [];
    }

    const pct = (cur: number, prev: number) => {
      if (prev <= 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 1000) / 10;
    };

    return {
      casinos,
      casinosPublished,
      bonuses,
      bonusesPublished,
      reviewsPending,
      reviewsApproved,
      reviewsDisplayTotal,
      articles,
      articlesPublished,
      slots,
      slotsPublished,
      banners,
      bannersActive,
      users,
      complaintsOpen,
      days,
      trends: {
        clicks7d,
        clicksPrev7d,
        clicksDeltaPct: pct(clicks7d, clicksPrev7d),
        reviews7d,
        reviewsPrev7d,
        reviewsDeltaPct: pct(reviews7d, reviewsPrev7d),
      },
      series,
      topCasinos,
      mix: [
        { name: "Казино", value: casinosPublished },
        { name: "Слоты", value: slotsPublished },
        { name: "Статьи", value: articlesPublished },
        { name: "Бонусы", value: bonusesPublished },
      ],
      generatedAt: new Date().toISOString(),
    };
  });


  // ── Casinos ──────────────────────────────────────────────────────
  app.get("/v1/admin/casinos", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, q } = pageParams(req.query);
    const query = req.query as {
      status?: string
      hot?: string
      sort?: string
    };
    const params: unknown[] = [];
    const whereParts: string[] = ["true"];
    if (q) {
      params.push(`%${q}%`);
      whereParts.push(`(c.slug ilike $${params.length} or c.name ilike $${params.length} or coalesce(c.name_ru,'') ilike $${params.length})`);
    }
    if (query.status === "published" || query.status === "draft" || query.status === "hidden") {
      params.push(query.status);
      whereParts.push(`c.status = $${params.length}`);
    }
    if (query.hot === "1" || query.hot === "true") {
      whereParts.push("c.hot = true");
    }
    const where = whereParts.join(" and ");
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const countParams = params.slice(0, -2);

    const sort = query.sort === "rating"
      ? "coalesce(c.final_rating, c.editorial_score, 0) desc nulls last, c.name"
      : query.sort === "name"
        ? "c.name asc"
        : query.sort === "clicks"
          ? "clicks_7d desc nulls last, c.name"
          : "c.sort_order asc nulls last, c.updated_at desc nulls last, c.name";

    const [{ rows: countRows }, { rows }, summaryRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from casinos c where ${where}`,
        countParams,
      ),
      pool.query(
        `
        select c.id, c.slug, c.name, c.name_ru, c.name_en, c.status, c.hot,
               c.has_representative, c.final_rating, c.editorial_score,
               c.logo_url, c.partner_url, c.updated_at, c.sort_order,
               coalesce((
                 select count(*)::int from bonuses b where b.casino_id = c.id
               ), 0) as bonus_count,
               coalesce((
                 select count(*)::int from reviews r where r.casino_id = c.id
               ), 0) as review_count,
               coalesce((
                 select count(*)::int from go_clicks g
                 where g.casino_id = c.id and g.created_at >= now() - interval '7 days'
               ), 0) as clicks_7d
        from casinos c
        where ${where}
        order by ${sort}
        limit ${lim} offset ${off}
        `,
        params,
      ),
      pool.query<{
        total: string
        published: string
        hot: string
        avg_rating: string | null
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where status = 'published')::text as published,
          count(*) filter (where hot = true)::text as hot,
          round(avg(coalesce(final_rating, editorial_score))::numeric, 2)::text as avg_rating
        from casinos
      `).catch(() => ({ rows: [] as { total: string, published: string, hot: string, avg_rating: string | null }[] })),
    ]);

    const s = summaryRes.rows[0];
    return {
      items: rows.map((r) => ({
        ...r,
        bonus_count: Number(r.bonus_count ?? 0),
        review_count: Number(r.review_count ?? 0),
        clicks_7d: Number(r.clicks_7d ?? 0),
      })),
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        published: Number(s?.published ?? 0),
        hot: Number(s?.hot ?? 0),
        avgRating: s?.avg_rating != null ? Number(s.avg_rating) : null,
      },
    };
  });

  app.get("/v1/admin/casinos/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(`select * from casinos where id = $1`, [id]);
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.patch("/v1/admin/casinos/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        name_ru: z.string().max(200).nullable().optional(),
        name_en: z.string().max(200).nullable().optional(),
        slug: z.string().min(1).max(120).optional(),
        status: z.enum(["draft", "review", "published"]).optional(),
        hot: z.boolean().optional(),
        has_representative: z.boolean().optional(),
        logo_url: z.string().max(1000).nullable().optional(),
        partner_url: z.string().max(1000).nullable().optional(),
        license: z.string().max(500).nullable().optional(),
        short_desc_ru: z.string().max(5000).nullable().optional(),
        short_desc_en: z.string().max(5000).nullable().optional(),
        description_ru: z.string().max(200_000).nullable().optional(),
        description_en: z.string().max(200_000).nullable().optional(),
        editorial_score: z.number().min(0).max(10).nullable().optional(),
        final_rating: z.number().min(0).max(10).nullable().optional(),
        published: z.boolean().optional(),
        seo: entitySeoSchema.optional(),
      })
      .safeParse(req.body);

    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const data = body.data;
    if (data.status === "published" && data.published === undefined) {
      data.published = true;
    }
    if (data.status && data.status !== "published" && data.published === undefined) {
      data.published = false;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    const push = (col: string, val: unknown) => {
      values.push(val);
      fields.push(`${col} = $${values.length}`);
    };

    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      if (key === "seo") {
        push(key, JSON.stringify(normalizeEntitySeo(val)));
        continue;
      }
      push(key, val);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });

    const { rows: beforeRows } = await pool.query(
      `select * from casinos where id = $1`,
      [id],
    );
    const prevRow = beforeRows[0] as Record<string, unknown> | undefined;
    const nextStatus = (data.status ?? prevRow?.status) as string | undefined;
    if (shouldValidatePublish(nextStatus, prevRow?.status as string | undefined)) {
      const merged = { ...(prevRow || {}), ...data, id };
      const validation = await validateEntitySeo(pool, {
        kind: "casino",
        id,
        slug: String(merged.slug || ""),
        status: nextStatus || "draft",
        name: (merged.name as string) || null,
        name_ru: (merged.name_ru as string) || null,
        name_en: (merged.name_en as string) || null,
        short_desc_ru: (merged.short_desc_ru as string) || null,
        short_desc_en: (merged.short_desc_en as string) || null,
        seo: merged.seo,
      });
      if (!validation.ok) {
        return reply.code(422).send({ error: "seo_invalid", validation });
      }
    }

    push("updated_at", new Date().toISOString());
    values.push(id);
    const { rows } = await pool.query(
      `update casinos set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    const prev = beforeRows[0]?.status as string | undefined;
    const next = rows[0].status as string;
    const slug = String(rows[0].slug || "");
    void runSeoPipeline(pool, {
      action:
        next === "published" && prev !== "published"
          ? "publish"
          : prev === "published" && next !== "published"
            ? "unpublish"
            : "update",
      kind: "casino",
      slug,
    }).catch(() => undefined);
    return { item: rows[0] };
  });

  app.delete("/v1/admin/casinos/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows: before } = await pool.query(`select slug from casinos where id = $1`, [id]);
    const { rowCount } = await pool.query(`delete from casinos where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    if (before[0]?.slug) {
      void runSeoPipeline(pool, {
        action: "delete",
        kind: "casino",
        slug: String(before[0].slug),
      }).catch(() => undefined);
    }
    return { ok: true };
  });

  app.post("/v1/admin/casinos", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        name: z.string().min(1).max(200),
        slug: z.string().min(1).max(120),
        status: z.enum(["draft", "review", "published"]).default("draft"),
        name_ru: z.string().max(200).nullable().optional(),
        name_en: z.string().max(200).nullable().optional(),
        hot: z.boolean().optional(),
        has_representative: z.boolean().optional(),
        logo_url: z.string().max(1000).nullable().optional(),
        partner_url: z.string().max(1000).nullable().optional(),
        license: z.string().max(500).nullable().optional(),
        short_desc_ru: z.string().max(5000).nullable().optional(),
        short_desc_en: z.string().max(5000).nullable().optional(),
        description_ru: z.string().max(200_000).nullable().optional(),
        description_en: z.string().max(200_000).nullable().optional(),
        editorial_score: z.number().min(0).max(10).nullable().optional(),
        final_rating: z.number().min(0).max(10).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const d = body.data;
    const published = d.status === "published";
    try {
      const { rows } = await pool.query(
        `
        insert into casinos (
          name, slug, status, published,
          name_ru, name_en, hot, has_representative,
          logo_url, partner_url, license,
          short_desc_ru, short_desc_en, description_ru, description_en,
          editorial_score, final_rating
        )
        values (
          $1,$2,$3,$4,
          coalesce($5,$1), coalesce($6,$1), coalesce($7,false), coalesce($8,false),
          $9,$10,$11,
          $12,$13,$14,$15,
          $16,$17
        )
        returning *
        `,
        [
          d.name,
          d.slug,
          d.status,
          published,
          d.name_ru ?? null,
          d.name_en ?? null,
          d.hot ?? false,
          d.has_representative ?? false,
          d.logo_url ?? null,
          d.partner_url ?? null,
          d.license ?? null,
          d.short_desc_ru ?? null,
          d.short_desc_en ?? null,
          d.description_ru ?? null,
          d.description_en ?? null,
          d.editorial_score ?? null,
          d.final_rating ?? null,
        ],
      );
      await bumpCasinoCache(redis);
      return reply.code(201).send({ item: rows[0] });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "23505") return reply.code(409).send({ error: "slug_taken" });
      throw err;
    }
  });


  // ── Bonuses ──────────────────────────────────────────────────────
  app.get("/v1/admin/bonuses", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, q } = pageParams(req.query);
    const query = req.query as {
      published?: string
      has_promo?: string
      casino?: string
      status?: string
    };
    const params: unknown[] = [];
    const whereParts: string[] = ["true"];
    if (q) {
      params.push(`%${q}%`);
      whereParts.push(`(b.title ilike $${params.length} or coalesce(b.title_ru,'') ilike $${params.length} or coalesce(b.promo_code,'') ilike $${params.length} or c.slug ilike $${params.length} or c.name ilike $${params.length})`);
    }
    if (query.published === "1" || query.published === "true") {
      whereParts.push("b.published = true and b.status = 'active'");
    } else if (query.published === "0" || query.published === "false") {
      whereParts.push("(b.published = false or b.status <> 'active')");
    }
    if (query.has_promo === "1" || query.has_promo === "true") {
      whereParts.push("coalesce(nullif(trim(b.promo_code), ''), null) is not null");
    }
    if (query.status === "active" || query.status === "hidden") {
      params.push(query.status);
      whereParts.push(`b.status = $${params.length}`);
    }
    if (query.casino) {
      params.push(query.casino);
      whereParts.push(`c.slug = $${params.length}`);
    }
    const where = whereParts.join(" and ");
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const countParams = params.slice(0, -2);

    const [{ rows: countRows }, { rows }, summaryRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from bonuses b join casinos c on c.id = b.casino_id where ${where}`,
        countParams,
      ),
      pool.query(
        `
        select b.id, b.title, b.title_ru, b.title_en, b.promo_code, b.type,
               b.status, b.published, b.wager, b.amount_or_percent, b.checked_by_editor,
               b.casino_id, c.slug as casino_slug, c.name as casino_name, b.created_at
        from bonuses b
        join casinos c on c.id = b.casino_id
        where ${where}
        order by b.created_at desc
        limit ${lim} offset ${off}
        `,
        params,
      ),
      pool.query<{
        total: string
        active: string
        with_promo: string
        top_casino: string | null
        top_casino_n: string | null
        w_none: string
        w_20_30: string
        w_30_40: string
        w_40p: string
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where published = true and status = 'active')::text as active,
          count(*) filter (where coalesce(nullif(trim(promo_code), ''), null) is not null)::text as with_promo,
          (
            select c.name from bonuses b2
            join casinos c on c.id = b2.casino_id
            group by c.name order by count(*) desc limit 1
          ) as top_casino,
          (
            select count(*)::text from bonuses b2
            join casinos c on c.id = b2.casino_id
            where c.name = (
              select c2.name from bonuses b3
              join casinos c2 on c2.id = b3.casino_id
              group by c2.name order by count(*) desc limit 1
            )
          ) as top_casino_n,
          count(*) filter (where nullif(regexp_replace(coalesce(wager,''), '[^0-9.]', '', 'g'), '') is null)::text as w_none,
          count(*) filter (
            where nullif(regexp_replace(coalesce(wager,''), '[^0-9.]', '', 'g'), '')::numeric >= 20
              and nullif(regexp_replace(coalesce(wager,''), '[^0-9.]', '', 'g'), '')::numeric < 30
          )::text as w_20_30,
          count(*) filter (
            where nullif(regexp_replace(coalesce(wager,''), '[^0-9.]', '', 'g'), '')::numeric >= 30
              and nullif(regexp_replace(coalesce(wager,''), '[^0-9.]', '', 'g'), '')::numeric < 40
          )::text as w_30_40,
          count(*) filter (
            where nullif(regexp_replace(coalesce(wager,''), '[^0-9.]', '', 'g'), '')::numeric >= 40
          )::text as w_40p
        from bonuses
      `).catch(() => ({ rows: [] as any[] })),
    ]);

    const s = summaryRes.rows[0];
    return {
      items: rows,
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        active: Number(s?.active ?? 0),
        withPromo: Number(s?.with_promo ?? 0),
        topCasino: s?.top_casino ?? null,
        topCasinoCount: Number(s?.top_casino_n ?? 0),
        wagerBuckets: [
          { label: 'без вейджера', value: Number(s?.w_none ?? 0) },
          { label: 'x20–30', value: Number(s?.w_20_30 ?? 0) },
          { label: 'x30–40', value: Number(s?.w_30_40 ?? 0) },
          { label: 'x40+', value: Number(s?.w_40p ?? 0) },
        ],
      },
    };
  });

  app.get("/v1/admin/bonuses/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      select b.*, c.slug as casino_slug, c.name as casino_name
      from bonuses b
      join casinos c on c.id = b.casino_id
      where b.id = $1
      `,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    const item = rows[0] as Record<string, unknown>;
    return {
      item: {
        ...item,
        description_ru: decodeStoredText(item.description_ru as string | null),
        description_en: decodeStoredText(item.description_en as string | null),
      },
    };
  });

  app.post("/v1/admin/bonuses", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        casino_id: z.string().uuid(),
        title: z.string().min(1).max(300),
        title_ru: z.string().max(300).nullable().optional(),
        title_en: z.string().max(300).nullable().optional(),
        promo_code: z.string().max(100).nullable().optional(),
        type: z.string().max(80).nullable().optional(),
        amount_or_percent: z.string().max(80).nullable().optional(),
        wager: z.string().max(40).nullable().optional(),
        min_deposit: z.string().max(80).nullable().optional(),
        valid_until: z.string().max(64).nullable().optional(),
        description_ru: z.string().max(20000).nullable().optional(),
        description_en: z.string().max(20000).nullable().optional(),
        status: z.enum(["active", "hidden"]).default("active"),
        published: z.boolean().default(false),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const d = body.data;
    const { rows: casinoRows } = await pool.query(
      `select id from casinos where id = $1`,
      [d.casino_id],
    );
    if (!casinoRows[0]) return reply.code(400).send({ error: "casino_not_found" });

    const { rows } = await pool.query(
      `
      insert into bonuses (
        casino_id, title, title_ru, title_en, promo_code, type,
        amount_or_percent, wager, min_deposit, valid_until,
        description_ru, description_en, status, published,
        checked_by_editor, checked_at, source
      ) values (
        $1,$2,coalesce($3,$2),$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,
        true, now(), 'manual_editor'
      )
      returning *
      `,
      [
        d.casino_id,
        d.title,
        d.title_ru ?? null,
        d.title_en ?? null,
        d.promo_code ?? null,
        d.type ?? null,
        d.amount_or_percent ?? null,
        d.wager ?? null,
        d.min_deposit ?? null,
        d.valid_until || null,
        decodeStoredText(d.description_ru ?? null),
        decodeStoredText(d.description_en ?? null),
        d.status,
        d.published,
      ],
    );
    await bumpCasinoCache(redis);
    const created = rows[0] as Record<string, unknown>;
    return reply.code(201).send({
      item: {
        ...created,
        description_ru: decodeStoredText(created.description_ru as string | null),
        description_en: decodeStoredText(created.description_en as string | null),
      },
    });
  });

  app.patch("/v1/admin/bonuses/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().min(1).max(300).optional(),
        title_ru: z.string().max(300).nullable().optional(),
        title_en: z.string().max(300).nullable().optional(),
        promo_code: z.string().max(100).nullable().optional(),
        type: z.string().max(80).nullable().optional(),
        amount_or_percent: z.string().max(80).nullable().optional(),
        wager: z.string().max(40).nullable().optional(),
        min_deposit: z.string().max(80).nullable().optional(),
        valid_until: z.string().max(64).nullable().optional(),
        description_ru: z.string().max(20000).nullable().optional(),
        description_en: z.string().max(20000).nullable().optional(),
        casino_id: z.string().uuid().optional(),
        status: z.enum(["active", "hidden"]).optional(),
        published: z.boolean().optional(),
        checked_by_editor: z.boolean().optional(),
        seo: entitySeoSchema.optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body.data)) {
      if (val === undefined) continue;
      if (key === "seo") {
        values.push(JSON.stringify(normalizeEntitySeo(val)));
        fields.push(`${key} = $${values.length}`);
        continue;
      }
      const stored =
        key === "description_ru" || key === "description_en"
          ? decodeStoredText(val as string | null)
          : val;
      values.push(stored);
      fields.push(`${key} = $${values.length}`);
      if (key === "checked_by_editor" && val === true) {
        values.push(new Date().toISOString());
        fields.push(`checked_at = $${values.length}`);
      }
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    const { rows } = await pool.query(
      `update bonuses set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    const item = rows[0] as Record<string, unknown>;
    return {
      item: {
        ...item,
        description_ru: decodeStoredText(item.description_ru as string | null),
        description_en: decodeStoredText(item.description_en as string | null),
      },
    };
  });

  app.delete("/v1/admin/bonuses/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from bonuses where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    return { ok: true };
  });

  // ── A/B reward Quality Yield report ──────────────────────────────

  app.get("/v1/admin/rewards/ab-report", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = (req.query ?? {}) as { days?: string };
    const days = Math.min(90, Math.max(1, Number(q.days) || 30));

    const { rows: byGroup } = await pool.query<{
      reward_group: string;
      submitted: string;
      approved: string;
      rejected: string;
      paid: string;
      avg_quality: string | null;
      reward_cost: string | null;
    }>(
      `
      select coalesce(reward_group, '?') as reward_group,
             count(*)::text as submitted,
             count(*) filter (where status = 'approved')::text as approved,
             count(*) filter (where status = 'rejected')::text as rejected,
             count(*) filter (where reward_status = 'paid')::text as paid,
             avg(ai_quality_score) filter (where status = 'approved')::text as avg_quality,
             coalesce(sum(reward_amount_usd) filter (where reward_status = 'paid'), 0)::text as reward_cost
      from reviews
      where created_at >= now() - make_interval(days => $1::int)
        and coalesce(origin, 'ugc') = 'ugc'
        and is_seed = false
      group by coalesce(reward_group, '?')
      order by reward_group
      `,
      [days],
    );

    const groups = byGroup.map((r) => {
      const approved = Number(r.approved);
      const cost = Number(r.reward_cost || 0);
      const avgQuality = r.avg_quality != null ? Number(r.avg_quality) : null;
      const qualityYield =
        cost > 0 && avgQuality != null ? Number(((avgQuality * approved) / cost).toFixed(2)) : null;
      const costPerQuality =
        avgQuality && avgQuality > 0 && cost > 0
          ? Number((cost / (avgQuality * Math.max(approved, 1))).toFixed(4))
          : null;
      return {
        group: r.reward_group,
        submitted: Number(r.submitted),
        approved,
        rejected: Number(r.rejected),
        paid: Number(r.paid),
        avgQuality,
        rewardCostUsd: cost,
        qualityYield,
        costPerQuality,
        approveRate: Number(r.submitted) ? approved / Number(r.submitted) : 0,
      };
    });

    return { days, groups };
  });

  // ── /go/ clicks report ───────────────────────────────────────────
  app.get("/v1/admin/clicks", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = (req.query ?? {}) as { days?: string; limit?: string; q?: string };
    const days = Math.min(90, Math.max(1, Number(q.days) || 30));
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const search = (q.q || "").trim();

    const params: unknown[] = [days];
    let whereExtra = "";
    if (search) {
      params.push(`%${search}%`);
      whereExtra = ` and (g.casino_slug ilike $${params.length} or coalesce(c.name,'') ilike $${params.length})`;
    }
    params.push(limit);

    const { rows: summary } = await pool.query<{
      total: string;
      unique_casinos: string;
      last_click: string | null;
    }>(
      `
      select count(*)::text as total,
             count(distinct casino_slug)::text as unique_casinos,
             max(created_at)::text as last_click
      from go_clicks
      where created_at >= now() - make_interval(days => $1::int)
      `,
      [days],
    );

    const { rows: byDay } = await pool.query<{ day: string; clicks: string }>(
      `
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*)::text as clicks
      from go_clicks
      where created_at >= now() - make_interval(days => $1::int)
      group by 1
      order by 1 asc
      `,
      [days],
    );

    const { rows: items } = await pool.query(
      `
      select g.casino_slug,
             coalesce(max(c.name), g.casino_slug) as casino_name,
             max(c.id::text) as casino_id,
             count(*)::int as clicks,
             max(g.created_at) as last_click
      from go_clicks g
      left join casinos c on c.slug = g.casino_slug
      where g.created_at >= now() - make_interval(days => $1::int)
      ${whereExtra}
      group by g.casino_slug
      order by clicks desc, last_click desc
      limit $${params.length}
      `,
      params,
    );

    return {
      days,
      summary: {
        total: Number(summary[0]?.total || 0),
        uniqueCasinos: Number(summary[0]?.unique_casinos || 0),
        lastClick: summary[0]?.last_click || null,
      },
      byDay: byDay.map((r) => ({ day: r.day, clicks: Number(r.clicks) })),
      items,
    };
  });

  // ── Reviews ──────────────────────────────────────────────────────
  app.get("/v1/admin/reviews", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, status, q } = pageParams(req.query);
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (status) {
      params.push(status);
      clauses.push(`rv.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      clauses.push(
        `(rv.body ilike $${params.length} or coalesce(rv.author_name,'') ilike $${params.length} or c.slug ilike $${params.length})`,
      );
    }
    const where = clauses.length ? clauses.join(" and ") : "true";
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;

    const countParams = params.slice(0, params.length - 2);
    const [{ rows: countRows }, { rows }, summaryRes, seriesRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from reviews rv join casinos c on c.id = rv.casino_id where ${where}`,
        countParams,
      ),
      pool.query(
        `
        select rv.id, rv.rating, rv.body, rv.status, rv.author_name, rv.origin,
               rv.created_at, rv.published_at, rv.casino_id,
               c.slug as casino_slug, c.name as casino_name,
               (
                 select count(*)::int from reviews d
                 where d.body = rv.body and d.id <> rv.id
               ) as duplicate_count
        from reviews rv
        join casinos c on c.id = rv.casino_id
        where ${where}
        order by
          case when rv.status = 'pending' then 0 else 1 end,
          rv.created_at desc
        limit ${lim} offset ${off}
        `,
        params,
      ),
      pool.query<{
        total: string
        pending: string
        approved: string
        rejected: string
        avg_rating: string | null
        r1: string
        r2: string
        r3: string
        r4: string
        r5: string
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where status = 'pending')::text as pending,
          count(*) filter (where status = 'approved')::text as approved,
          count(*) filter (where status = 'rejected')::text as rejected,
          round(avg(rating)::numeric, 2)::text as avg_rating,
          count(*) filter (where rating = 1)::text as r1,
          count(*) filter (where rating = 2)::text as r2,
          count(*) filter (where rating = 3)::text as r3,
          count(*) filter (where rating = 4)::text as r4,
          count(*) filter (where rating = 5)::text as r5
        from reviews
      `).catch(() => ({ rows: [] as any[] })),
      pool.query<{ day: string, n: string }>(`
        with days as (
          select generate_series(
            (current_date - 29)::timestamp,
            current_date::timestamp,
            interval '1 day'
          )::date as day
        )
        select to_char(d.day, 'YYYY-MM-DD') as day,
               coalesce(r.n, 0)::text as n
        from days d
        left join (
          select date_trunc('day', created_at)::date as day, count(*)::int as n
          from reviews
          where created_at >= current_date - 29
          group by 1
        ) r on r.day = d.day
        order by d.day
      `).catch(() => ({ rows: [] as { day: string, n: string }[] })),
    ]);

    const s = summaryRes.rows[0];
    return {
      items: rows.map((r) => ({
        ...r,
        duplicate_count: Number(r.duplicate_count ?? 0),
      })),
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        pending: Number(s?.pending ?? 0),
        approved: Number(s?.approved ?? 0),
        rejected: Number(s?.rejected ?? 0),
        avgRating: s?.avg_rating != null ? Number(s.avg_rating) : null,
        ratingBars: [
          { star: 1, value: Number(s?.r1 ?? 0) },
          { star: 2, value: Number(s?.r2 ?? 0) },
          { star: 3, value: Number(s?.r3 ?? 0) },
          { star: 4, value: Number(s?.r4 ?? 0) },
          { star: 5, value: Number(s?.r5 ?? 0) },
        ],
        series: seriesRes.rows.map(r => ({ date: r.day, reviews: Number(r.n) })),
      },
    };
  });

  app.patch("/v1/admin/reviews/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        body: z.string().min(1).max(20000).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        author_name: z.string().max(200).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body.data)) {
      if (val === undefined) continue;
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
    if (body.data.status === "approved") {
      values.push(new Date().toISOString());
      fields.push(`published_at = coalesce(published_at, $${values.length})`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    const { rows } = await pool.query(
      `update reviews set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    if (body.data.status !== undefined) {
      await recalcCasinoRatings(pool, rows[0].casino_id as string);
      await bumpCasinoCache(redis);
    }
    if (body.data.status === "approved") {
      await grantReviewApprovedXp(pool, {
        playerId: (rows[0].player_id as string | null) ?? null,
        aiQualityScore:
          rows[0].ai_quality_score != null ? Number(rows[0].ai_quality_score) : null,
      });
    }
    return { item: rows[0] };
  });

  /** Live host / process metrics — admin & developer only. */
  app.get("/v1/admin/server-stats", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return collectServerStats();
  });

  /** Lightweight ops snapshot (admin / developer). */
  app.get("/v1/admin/ops", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const started = Date.now();
    const counts = async (sql: string) => {
      try {
        const { rows } = await pool.query<{ n: string }>(sql);
        return Number(rows[0]?.n || 0);
      }
      catch {
        return -1;
      }
    };
    let redisOk = false;
    try {
      redisOk = (await redis.ping()) === "PONG";
    }
    catch {
      redisOk = false;
    }
    const payload = {
      ok: true,
      dbMs: 0,
      redisOk,
      role: req.staffUser?.role,
      canAdmin: isAdminRole(req.staffUser?.role || ""),
      counts: {
        casinosPublished: await counts(`select count(*)::text as n from casinos where status='published'`),
        reviewsPending: await counts(`select count(*)::text as n from reviews where status='pending'`),
        reviewsApproved: await counts(`select count(*)::text as n from reviews where status='approved'`),
        complaintsOpen: await counts(`select count(*)::text as n from complaints where status in ('new','in_review','need_info')`),
        blacklistPublished: await counts(`select count(*)::text as n from blacklist_entries where status='published'`),
        bonusesActive: await counts(`select count(*)::text as n from bonuses where status='active' and published=true`),
        articlesPublished: await counts(`select count(*)::text as n from articles where status='published'`),
        playersWithProgress: await counts(`select count(*)::text as n from player_progress`),
      },
    };
    payload.dbMs = Date.now() - started;
    return payload;
  });

  app.delete("/v1/admin/reviews/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query<{ casino_id: string }>(
      `delete from reviews where id = $1 returning casino_id`,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await recalcCasinoRatings(pool, rows[0].casino_id);
    await bumpCasinoCache(redis);
    return { ok: true };
  });

  // ── Articles ─────────────────────────────────────────────────────

  app.get("/v1/admin/articles", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, q } = pageParams(req.query);
    const query = req.query as { status?: string, kind?: string };
    const params: unknown[] = [];
    const whereParts: string[] = ["true"];
    if (q) {
      params.push(`%${q}%`);
      whereParts.push(`(a.slug ilike $${params.length} or a.title_ru ilike $${params.length} or a.title_en ilike $${params.length})`);
    }
    if (query.status === "published" || query.status === "draft") {
      params.push(query.status);
      whereParts.push(`a.status = $${params.length}`);
    }
    if (query.kind) {
      params.push(query.kind);
      whereParts.push(`a.kind = $${params.length}`);
    }
    const where = whereParts.join(" and ");
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const countParams = params.slice(0, -2);
    const [{ rows: countRows }, { rows }, summaryRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from articles a where ${where}`,
        countParams,
      ),
      pool.query(
        `
        select a.id, a.slug, a.kind, a.title_ru, a.title_en, a.status,
               a.published_at, a.updated_at, a.reading_minutes, a.cover_url
        from articles a
        where ${where}
        order by a.updated_at desc
        limit ${lim} offset ${off}
        `,
        params,
      ),
      pool.query<{
        total: string
        published: string
        draft: string
        guide: string
        news: string
        analytics: string
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where status = 'published')::text as published,
          count(*) filter (where status = 'draft')::text as draft,
          count(*) filter (where kind = 'guide')::text as guide,
          count(*) filter (where kind = 'news')::text as news,
          count(*) filter (where kind = 'analytics')::text as analytics
        from articles
      `).catch(() => ({ rows: [] as any[] })),
    ]);
    const s = summaryRes.rows[0];
    return {
      items: rows,
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        published: Number(s?.published ?? 0),
        draft: Number(s?.draft ?? 0),
        byKind: [
          { name: 'guide', value: Number(s?.guide ?? 0) },
          { name: 'news', value: Number(s?.news ?? 0) },
          { name: 'analytics', value: Number(s?.analytics ?? 0) },
        ].filter(i => i.value > 0),
      },
    };
  });

  app.get("/v1/admin/articles/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(`select * from articles where id = $1`, [id]);
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.post("/v1/admin/articles", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        slug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        title_ru: z.string().min(1).max(500),
        title_en: z.string().min(1).max(500),
        excerpt_ru: z.string().max(5000).nullable().optional(),
        excerpt_en: z.string().max(5000).nullable().optional(),
        body_md_ru: z.string().max(200000).nullable().optional(),
        body_md_en: z.string().max(200000).nullable().optional(),
        status: z.enum(["draft", "published", "hidden"]).default("draft"),
        kind: z.string().max(80).default("guide"),
        topic: z.string().max(120).nullable().optional(),
        cover_theme: z.string().max(80).optional(),
        cover_url: z.string().max(1000).nullable().optional(),
        reading_minutes: z.number().int().min(1).max(120).default(5),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const d = body.data;
    try {
      const { rows } = await pool.query(
        `
        insert into articles (
          slug, kind, topic, title_ru, title_en, excerpt_ru, excerpt_en,
          body_md_ru, body_md_en, cover_theme, cover_url, reading_minutes, status, published_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13,
          case when $13 = 'published' then now() else now() end
        )
        returning *
        `,
        [
          d.slug,
          d.kind,
          d.topic ?? null,
          d.title_ru,
          d.title_en,
          d.excerpt_ru ?? null,
          d.excerpt_en ?? null,
          d.body_md_ru ?? null,
          d.body_md_en ?? null,
          d.cover_theme || d.kind || "guide",
          d.cover_url ?? null,
          d.reading_minutes,
          d.status,
        ],
      );
      return reply.code(201).send({ item: rows[0] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("articles_slug_key")) {
        return reply.code(409).send({ error: "slug_taken" });
      }
      throw err;
    }
  });

  app.patch("/v1/admin/articles/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title_ru: z.string().min(1).max(500).optional(),
        title_en: z.string().min(1).max(500).optional(),
        excerpt_ru: z.string().max(5000).nullable().optional(),
        excerpt_en: z.string().max(5000).nullable().optional(),
        body_md_ru: z.string().max(200000).nullable().optional(),
        body_md_en: z.string().max(200000).nullable().optional(),
        status: z.enum(["draft", "published", "hidden"]).optional(),
        kind: z.string().max(80).optional(),
        topic: z.string().max(120).nullable().optional(),
        cover_theme: z.string().max(80).optional(),
        cover_url: z.string().max(1000).nullable().optional(),
        cover_data_url: z.string().max(8_000_000).optional(),
        reading_minutes: z.number().int().min(1).max(120).optional(),
        seo: entitySeoSchema.optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const data = { ...body.data } as Record<string, unknown>;
    const seoDraft = data.seo;
    if (typeof data.cover_data_url === "string" && data.cover_data_url.startsWith("data:image/")) {
      const saved = await saveArticleCover(id, data.cover_data_url);
      if (!saved) return reply.code(400).send({ error: "invalid_cover" });
      data.cover_url = saved;
      delete data.cover_data_url;
    } else {
      delete data.cover_data_url;
    }
    if (data.seo !== undefined) {
      data.seo = JSON.stringify(normalizeEntitySeo(data.seo));
    }

    const { rows: beforeRows } = await pool.query(
      `select * from articles where id = $1`,
      [id],
    );
    const prevRow = beforeRows[0] as Record<string, unknown> | undefined;
    const nextStatus = (data.status ?? prevRow?.status) as string | undefined;
    if (shouldValidatePublish(nextStatus, prevRow?.status as string | undefined)) {
      const merged = { ...(prevRow || {}), ...body.data, id };
      const validation = await validateEntitySeo(pool, {
        kind: "article",
        id,
        slug: String(prevRow?.slug || ""),
        status: nextStatus || "draft",
        title_ru: (merged.title_ru as string) || null,
        title_en: (merged.title_en as string) || null,
        excerpt_ru: (merged.excerpt_ru as string) || null,
        excerpt_en: (merged.excerpt_en as string) || null,
        seo: seoDraft !== undefined ? seoDraft : prevRow?.seo,
      });
      if (!validation.ok) {
        return reply.code(422).send({ error: "seo_invalid", validation });
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(new Date().toISOString());
    fields.push(`updated_at = $${values.length}`);
    values.push(id);
    const { rows } = await pool.query(
      `update articles set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    const prev = beforeRows[0]?.status as string | undefined;
    const next = rows[0].status as string;
    const slug = String(rows[0].slug || "");
    void runSeoPipeline(pool, {
      action:
        next === "published" && prev !== "published"
          ? "publish"
          : prev === "published" && next !== "published"
            ? "unpublish"
            : "update",
      kind: "article",
      slug,
    }).catch(() => undefined);
    return { item: rows[0] };
  });

  app.delete("/v1/admin/articles/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows: before } = await pool.query(`select slug from articles where id = $1`, [id]);
    const { rowCount } = await pool.query(`delete from articles where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    if (before[0]?.slug) {
      void runSeoPipeline(pool, {
        action: "delete",
        kind: "article",
        slug: String(before[0].slug),
      }).catch(() => undefined);
    }
    return { ok: true };
  });

  // ── Slots ────────────────────────────────────────────────────────
  app.get("/v1/admin/slots", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, q } = pageParams(req.query);
    const query = req.query as {
      status?: string
      volatility?: string
      provider?: string
    };
    const params: unknown[] = [];
    const whereParts: string[] = ["true"];
    if (q) {
      params.push(`%${q}%`);
      whereParts.push(`(s.slug ilike $${params.length} or s.title ilike $${params.length})`);
    }
    if (query.status === "published" || query.status === "draft" || query.status === "hidden") {
      params.push(query.status);
      whereParts.push(`s.status = $${params.length}`);
    }
    if (query.volatility) {
      params.push(query.volatility);
      whereParts.push(`s.volatility = $${params.length}`);
    }
    if (query.provider) {
      params.push(query.provider);
      whereParts.push(`gp.slug = $${params.length}`);
    }
    const where = whereParts.join(" and ");
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const countParams = params.slice(0, -2);

    const [{ rows: countRows }, { rows }, summaryRes, providersRes] = await Promise.all([
      pool.query<{ n: string }>(
        `
        select count(*)::text as n
        from slots s
        left join game_providers gp on gp.id = s.provider_id
        where ${where}
        `,
        countParams,
      ),
      pool.query(
        `
        select s.id, s.slug, s.title, s.theme, s.volatility, s.rtp, s.status,
               s.created_at, gp.name as provider_name, gp.slug as provider_slug
        from slots s
        left join game_providers gp on gp.id = s.provider_id
        where ${where}
        order by s.created_at desc
        limit ${lim} offset ${off}
        `,
        params,
      ),
      pool.query<{
        total: string
        published: string
        providers: string
        avg_rtp: string | null
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where status = 'published')::text as published,
          count(distinct provider_id)::text as providers,
          round(avg(rtp) filter (where rtp is not null)::numeric, 2)::text as avg_rtp
        from slots
      `).catch(() => ({ rows: [] as { total: string, published: string, providers: string, avg_rtp: string | null }[] })),
      pool.query<{ slug: string, name: string, n: string }>(`
        select gp.slug, gp.name, count(*)::text as n
        from slots s
        join game_providers gp on gp.id = s.provider_id
        group by gp.slug, gp.name
        order by count(*) desc
        limit 6
      `).catch(() => ({ rows: [] as { slug: string, name: string, n: string }[] })),
    ]);

    const s = summaryRes.rows[0];
    return {
      items: rows,
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        published: Number(s?.published ?? 0),
        providers: Number(s?.providers ?? 0),
        avgRtp: s?.avg_rtp != null ? Number(s.avg_rtp) : null,
        topProviders: providersRes.rows.map(r => ({
          slug: r.slug,
          name: r.name,
          count: Number(r.n),
        })),
      },
    };
  });

  app.get("/v1/admin/game-providers", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { rows } = await pool.query(
      `select id, slug, name, status from game_providers order by name asc`,
    );
    return { items: rows };
  });

  app.get("/v1/admin/slots/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      select s.*, gp.name as provider_name, gp.slug as provider_slug
      from slots s
      left join game_providers gp on gp.id = s.provider_id
      where s.id = $1
      limit 1
      `,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.post("/v1/admin/slots", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        title: z.string().min(1).max(300),
        slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        status: z.enum(["draft", "published", "hidden"]).default("draft"),
        theme: z.string().max(80).optional(),
        volatility: z.string().max(40).optional(),
        rtp: z.number().min(0).max(100).nullable().optional(),
        provider_id: z.string().uuid().nullable().optional(),
        demo_url: z.string().max(2000).nullable().optional(),
        grid: z.string().max(40).nullable().optional(),
        release_date: z.string().max(32).nullable().optional(),
        description_ru: z.string().max(20000).nullable().optional(),
        description_en: z.string().max(20000).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    try {
      const { rows } = await pool.query(
        `
        insert into slots (
          title, slug, status, theme, volatility, rtp, provider_id,
          demo_url, grid, release_date, description_ru, description_en
        )
        values ($1,$2,$3,coalesce($4,'fruits'),coalesce($5,'medium'),$6,$7,$8,$9,$10,$11,$12)
        returning *
        `,
        [
          body.data.title,
          body.data.slug,
          body.data.status,
          body.data.theme ?? null,
          body.data.volatility ?? null,
          body.data.rtp ?? null,
          body.data.provider_id ?? null,
          body.data.demo_url ?? null,
          body.data.grid ?? null,
          body.data.release_date ?? null,
          body.data.description_ru ?? null,
          body.data.description_en ?? null,
        ],
      );
      return reply.code(201).send({ item: rows[0] });
    }
    catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "23505") return reply.code(409).send({ error: "slug_taken" });
      throw err;
    }
  });


  app.patch("/v1/admin/slots/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().min(1).max(300).optional(),
        slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
        status: z.enum(["draft", "published", "hidden"]).optional(),
        theme: z.string().max(80).optional(),
        volatility: z.string().max(40).optional(),
        rtp: z.number().min(0).max(100).nullable().optional(),
        provider_id: z.string().uuid().nullable().optional(),
        demo_url: z.string().max(2000).nullable().optional(),
        grid: z.string().max(40).nullable().optional(),
        release_date: z.string().max(32).nullable().optional(),
        description_ru: z.string().max(20000).nullable().optional(),
        description_en: z.string().max(20000).nullable().optional(),
        seo: entitySeoSchema.optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: beforeRows } = await pool.query(
      `select * from slots where id = $1`,
      [id],
    );
    const prevRow = beforeRows[0] as Record<string, unknown> | undefined;
    const nextStatus = (body.data.status ?? prevRow?.status) as string | undefined;
    if (shouldValidatePublish(nextStatus, prevRow?.status as string | undefined)) {
      const merged = { ...(prevRow || {}), ...body.data, id };
      const validation = await validateEntitySeo(pool, {
        kind: "slot",
        id,
        slug: String(merged.slug || ""),
        status: nextStatus || "draft",
        title: (merged.title as string) || null,
        description_ru: (merged.description_ru as string) || null,
        description_en: (merged.description_en as string) || null,
        seo: merged.seo,
      });
      if (!validation.ok) {
        return reply.code(422).send({ error: "seo_invalid", validation });
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body.data)) {
      if (val === undefined) continue;
      if (key === "seo") {
        values.push(JSON.stringify(normalizeEntitySeo(val)));
        fields.push(`${key} = $${values.length}`);
        continue;
      }
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    try {
      const { rows } = await pool.query(
        `update slots set ${fields.join(", ")} where id = $${values.length} returning *`,
        values,
      );
      if (!rows[0]) return reply.code(404).send({ error: "not_found" });
      const prev = beforeRows[0]?.status as string | undefined;
      const next = rows[0].status as string;
      const slug = String(rows[0].slug || "");
      void runSeoPipeline(pool, {
        action:
          next === "published" && prev !== "published"
            ? "publish"
            : prev === "published" && next !== "published"
              ? "unpublish"
              : "update",
        kind: "slot",
        slug,
      }).catch(() => undefined);
      return { item: rows[0] };
    }
    catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "23505") return reply.code(409).send({ error: "slug_taken" });
      throw err;
    }
  });

  app.delete("/v1/admin/slots/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows: before } = await pool.query(`select slug from slots where id = $1`, [id]);
    const { rowCount } = await pool.query(`delete from slots where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    if (before[0]?.slug) {
      void runSeoPipeline(pool, {
        action: "delete",
        kind: "slot",
        slug: String(before[0].slug),
      }).catch(() => undefined);
    }
    return { ok: true };
  });

  // ── Banners ──────────────────────────────────────────────────────

  const BANNER_UPLOADS = path.resolve(
    process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public"),
    "uploads/banners",
  );

  async function saveBannerImage(dataUrl: string, kind: "ru" | "en"): Promise<string | null> {
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed || parsed.ext === "svg") return null;
    if (!parsed.buf.length || parsed.buf.length > 8_000_000) return null;
    const basename = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      return await saveRasterAsWebp({
        dir: BANNER_UPLOADS,
        basename,
        buf: parsed.buf,
        publicPathPrefix: "/uploads/banners",
      });
    } catch {
      return null;
    }
  }

  app.get("/v1/admin/banners", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const placement = String((req.query as { placement?: string }).placement || "").trim();
    const params: unknown[] = [];
    let where = "true";
    if (placement) {
      params.push(placement);
      where = `placement = $1`;
    }
    const [{ rows }, summaryRes] = await Promise.all([
      pool.query(
        `
        select id, slug, placement, title_ru, title_en, image_ru, image_en,
               href_ru, href_en, sort_order, active, updated_at
        from banners
        where ${where}
        order by placement, sort_order, slug
        `,
        params,
      ),
      pool.query<{
        total: string
        active: string
        inactive: string
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where active = true)::text as active,
          count(*) filter (where active = false)::text as inactive
        from banners
      `).catch(() => ({ rows: [] as any[] })),
    ]);
    const byPlacement = await pool.query<{ placement: string, n: string }>(`
      select placement, count(*)::text as n from banners group by placement order by count(*) desc
    `).catch(() => ({ rows: [] as { placement: string, n: string }[] }));
    const s = summaryRes.rows[0];
    return {
      items: rows,
      summary: {
        total: Number(s?.total ?? 0),
        active: Number(s?.active ?? 0),
        inactive: Number(s?.inactive ?? 0),
        byPlacement: byPlacement.rows.map(r => ({
          placement: r.placement,
          count: Number(r.n),
        })),
      },
    };
  });

  app.post("/v1/admin/banners", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
        placement: z.string().max(80).default("home_hero"),
        title_ru: z.string().max(300).nullable().optional(),
        title_en: z.string().max(300).nullable().optional(),
        image_ru: z.string().max(1000).optional(),
        image_en: z.string().max(1000).optional(),
        image_ru_data_url: z.string().max(10_000_000).optional(),
        image_en_data_url: z.string().max(10_000_000).optional(),
        href_ru: z.string().max(1000).nullable().optional(),
        href_en: z.string().max(1000).nullable().optional(),
        sort_order: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    let imageRu = body.data.image_ru || "";
    let imageEn = body.data.image_en || "";
    if (body.data.image_ru_data_url) {
      const saved = await saveBannerImage(body.data.image_ru_data_url, "ru");
      if (!saved) return reply.code(400).send({ error: "invalid_image_ru" });
      imageRu = saved;
    }
    if (body.data.image_en_data_url) {
      const saved = await saveBannerImage(body.data.image_en_data_url, "en");
      if (!saved) return reply.code(400).send({ error: "invalid_image_en" });
      imageEn = saved;
    }
    if (!imageRu || !imageEn) {
      return reply.code(400).send({ error: "images_required" });
    }

    const slug = body.data.slug || `banner-${Date.now().toString(36)}`;
    const sortOrder = body.data.sort_order ?? Date.now() % 100000;
    try {
      const { rows } = await pool.query(
        `
        insert into banners (
          slug, placement, title_ru, title_en, image_ru, image_en,
          href_ru, href_en, sort_order, active
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        returning *
        `,
        [
          slug,
          body.data.placement || "home_hero",
          body.data.title_ru ?? null,
          body.data.title_en ?? null,
          imageRu,
          imageEn,
          body.data.href_ru ?? null,
          body.data.href_en ?? null,
          sortOrder,
          body.data.active ?? true,
        ],
      );
      return reply.code(201).send({ item: rows[0] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("banners_slug_key")) return reply.code(409).send({ error: "slug_taken" });
      throw err;
    }
  });

  app.patch("/v1/admin/banners/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title_ru: z.string().max(300).nullable().optional(),
        title_en: z.string().max(300).nullable().optional(),
        image_ru: z.string().max(1000).optional(),
        image_en: z.string().max(1000).optional(),
        image_ru_data_url: z.string().max(10_000_000).optional(),
        image_en_data_url: z.string().max(10_000_000).optional(),
        href_ru: z.string().max(1000).nullable().optional(),
        href_en: z.string().max(1000).nullable().optional(),
        sort_order: z.number().int().optional(),
        active: z.boolean().optional(),
        placement: z.string().max(80).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const data = { ...body.data } as Record<string, unknown>;
    if (typeof data.image_ru_data_url === "string") {
      const saved = await saveBannerImage(String(data.image_ru_data_url), "ru");
      if (!saved) return reply.code(400).send({ error: "invalid_image_ru" });
      data.image_ru = saved;
      delete data.image_ru_data_url;
    } else {
      delete data.image_ru_data_url;
    }
    if (typeof data.image_en_data_url === "string") {
      const saved = await saveBannerImage(String(data.image_en_data_url), "en");
      if (!saved) return reply.code(400).send({ error: "invalid_image_en" });
      data.image_en = saved;
      delete data.image_en_data_url;
    } else {
      delete data.image_en_data_url;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(new Date().toISOString());
    fields.push(`updated_at = $${values.length}`);
    values.push(id);
    const { rows } = await pool.query(
      `update banners set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.delete("/v1/admin/banners/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from banners where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  // ── Users ────────────────────────────────────────────────────────
  app.get("/v1/admin/users", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { q, role, page, limit, offset } = pageParams(req.query);
    const params: unknown[] = [];
    const where: string[] = ["true"];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(u.email ilike $${params.length} or coalesce(u.display_name,'') ilike $${params.length})`);
    }
    if (role) {
      params.push(role);
      where.push(`r.code = $${params.length}`);
    }
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const filterParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await pool.query<{ n: string }>(
      `
      select count(*)::text as n
      from users u
      join roles r on r.id = u.role_id
      where ${where.join(" and ")}
      `,
      filterParams,
    );
    const { rows } = await pool.query(
      `
      select u.id, u.email, u.display_name, u.is_active, u.casino_id, u.created_at,
             r.code as role, r.is_staff, c.slug as casino_slug
      from users u
      join roles r on r.id = u.role_id
      left join casinos c on c.id = u.casino_id
      where ${where.join(" and ")}
      order by r.is_staff desc, u.email
      limit ${lim} offset ${off}
      `,
      params,
    );
    return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
  });

  app.patch("/v1/admin/users/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        is_active: z.boolean().optional(),
        role: z.enum(["admin", "developer", "lawyer", "editor", "author", "partner_rep", "player"]).optional(),


        display_name: z.string().min(1).max(120).nullable().optional(),
        casino_id: z.string().uuid().nullable().optional(),
        casino_slug: z.string().min(1).max(120).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.is_active !== undefined) {
      values.push(body.data.is_active);
      fields.push(`is_active = $${values.length}`);
    }
    if (body.data.display_name !== undefined) {
      values.push(body.data.display_name);
      fields.push(`display_name = $${values.length}`);
    }
    if (body.data.role) {
      const roleRes = await pool.query<{ id: string }>(
        `select id from roles where code = $1 limit 1`,
        [body.data.role],
      );
      if (!roleRes.rows[0]) return reply.code(400).send({ error: "unknown_role" });
      values.push(roleRes.rows[0].id);
      fields.push(`role_id = $${values.length}`);
    }
    if (body.data.casino_id !== undefined) {
      values.push(body.data.casino_id);
      fields.push(`casino_id = $${values.length}`);
    } else if (body.data.casino_slug !== undefined) {
      if (body.data.casino_slug === null) {
        values.push(null);
        fields.push(`casino_id = $${values.length}`);
      } else {
        const c = await pool.query<{ id: string }>(
          `select id from casinos where slug = $1 limit 1`,
          [body.data.casino_slug],
        );
        if (!c.rows[0]) return reply.code(400).send({ error: "unknown_casino" });
        values.push(c.rows[0].id);
        fields.push(`casino_id = $${values.length}`);
      }
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    const { rows } = await pool.query(
      `
      update users set ${fields.join(", ")}
      where id = $${values.length}
      returning id, email, display_name, is_active, role_id, casino_id, created_at
      `,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    const { rows: full } = await pool.query(
      `
      select u.id, u.email, u.display_name, u.is_active, u.casino_id, u.created_at,
             r.code as role, r.is_staff, c.slug as casino_slug
      from users u
      join roles r on r.id = u.role_id
      left join casinos c on c.id = u.casino_id
      where u.id = $1
      `,
      [id],
    );
    return { item: full[0] };
  });

  app.delete("/v1/admin/users/:id", async (req, reply) => {
    const staff = requireAdmin(req, reply);
    if (!staff) return;
    const { id } = req.params as { id: string };
    if (staff.id === id) {
      return reply.code(400).send({ error: "cannot_delete_self" });
    }
    const { rowCount } = await pool.query(`delete from users where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });
}


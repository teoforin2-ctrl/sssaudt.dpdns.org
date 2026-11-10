import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { decodeStoredText } from "@x-reviewer/shared";
import { requireStaff, requireAdmin, isAdminRole } from "./auth.js";
import { bumpCasinoCache } from "./cache.js";
import { recalcCasinoRatings } from "./reviews.js";
import { grantReviewApprovedXp } from "./gamification.js";
import { collectServerStats } from "./server-stats.js";


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
  const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
  const buf = Buffer.from(m[3], "base64");
  if (buf.length > 5_000_000) return null;
  await mkdir(WEB_UPLOADS, { recursive: true });
  const filename = `${articleId}.${ext}`;
  await writeFile(path.join(WEB_UPLOADS, filename), buf);
  return `/uploads/articles/${filename}`;
}

async function saveContentImage(dataUrl: string, folder = "content"): Promise<string | null> {
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
  const buf = Buffer.from(m[3], "base64");
  if (buf.length > 5_000_000) return null;
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "") || "content";
  const dir =
    safeFolder === "articles"
      ? WEB_UPLOADS
      : path.join(path.dirname(WEB_CONTENT_UPLOADS), safeFolder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  await writeFile(path.join(dir, filename), buf);
  return `/uploads/${safeFolder}/${filename}`;
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
    const params: unknown[] = [];
    let where = "true";
    if (q) {
      params.push(`%${q}%`);
      where = `(c.slug ilike $1 or c.name ilike $1 or coalesce(c.name_ru,'') ilike $1)`;
    }
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;

    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from casinos c where ${where}`,
      q ? [params[0]] : [],
    );
    const { rows } = await pool.query(
      `
      select c.id, c.slug, c.name, c.name_ru, c.name_en, c.status, c.hot,
             c.has_representative, c.final_rating, c.editorial_score,
             c.logo_url, c.partner_url, c.updated_at, c.sort_order
      from casinos c
      where ${where}
      order by c.sort_order asc nulls last, c.updated_at desc nulls last, c.name
      limit ${lim} offset ${off}
      `,
      params,
    );

    return {
      items: rows,
      total: Number(countRows[0]?.n ?? 0),
      page,
      limit,
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
      if (val !== undefined) push(key, val);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });

    push("updated_at", new Date().toISOString());
    values.push(id);

    const { rows } = await pool.query(
      `update casinos set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    return { item: rows[0] };
  });

  app.delete("/v1/admin/casinos/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from casinos where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
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
    const params: unknown[] = [];
    let where = "true";
    if (q) {
      params.push(`%${q}%`);
      where = `(b.title ilike $1 or coalesce(b.title_ru,'') ilike $1 or coalesce(b.promo_code,'') ilike $1 or c.slug ilike $1)`;
    }
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;

    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from bonuses b join casinos c on c.id = b.casino_id where ${where}`,
      q ? [params[0]] : [],
    );
    const { rows } = await pool.query(
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
    );
    return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
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
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body.data)) {
      if (val === undefined) continue;
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
    if (!requireStaff(req, reply)) return;
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
    if (!requireStaff(req, reply)) return;
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
    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from reviews rv join casinos c on c.id = rv.casino_id where ${where}`,
      countParams,
    );
    const { rows } = await pool.query(
      `
      select rv.id, rv.rating, rv.body, rv.status, rv.author_name, rv.origin,
             rv.created_at, rv.published_at, rv.casino_id,
             c.slug as casino_slug, c.name as casino_name
      from reviews rv
      join casinos c on c.id = rv.casino_id
      where ${where}
      order by
        case when rv.status = 'pending' then 0 else 1 end,
        rv.created_at desc
      limit ${lim} offset ${off}
      `,
      params,
    );
    return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
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

  /** Lightweight ops snapshot for staff (p4-observability lite). */
  app.get("/v1/admin/ops", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
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
    const params: unknown[] = [];
    let where = "true";
    if (q) {
      params.push(`%${q}%`);
      where = `(a.slug ilike $1 or a.title_ru ilike $1 or a.title_en ilike $1)`;
    }
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from articles a where ${where}`,
      q ? [params[0]] : [],
    );
    const { rows } = await pool.query(
      `
      select a.id, a.slug, a.kind, a.title_ru, a.title_en, a.status,
             a.published_at, a.updated_at, a.reading_minutes
      from articles a
      where ${where}
      order by a.updated_at desc
      limit ${lim} offset ${off}
      `,
      params,
    );
    return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
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
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const data = { ...body.data } as Record<string, unknown>;
    if (typeof data.cover_data_url === "string" && data.cover_data_url.startsWith("data:image/")) {
      const saved = await saveArticleCover(id, data.cover_data_url);
      if (!saved) return reply.code(400).send({ error: "invalid_cover" });
      data.cover_url = saved;
      delete data.cover_data_url;
    } else {
      delete data.cover_data_url;
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
    return { item: rows[0] };
  });

  app.delete("/v1/admin/articles/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from articles where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  // ── Slots ────────────────────────────────────────────────────────
  app.get("/v1/admin/slots", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, q } = pageParams(req.query);
    const params: unknown[] = [];
    let where = "true";
    if (q) {
      params.push(`%${q}%`);
      where = `(s.slug ilike $1 or s.title ilike $1)`;
    }
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from slots s where ${where}`,
      q ? [params[0]] : [],
    );
    const { rows } = await pool.query(
      `
      select s.id, s.slug, s.title, s.theme, s.volatility, s.rtp, s.status,
             s.created_at, gp.name as provider_name
      from slots s
      left join game_providers gp on gp.id = s.provider_id
      where ${where}
      order by s.created_at desc
      limit ${lim} offset ${off}
      `,
      params,
    );
    return { items: rows, total: Number(countRows[0]?.n ?? 0), page, limit };
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
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    try {
      const { rows } = await pool.query(
        `update slots set ${fields.join(", ")} where id = $${values.length} returning *`,
        values,
      );
      if (!rows[0]) return reply.code(404).send({ error: "not_found" });
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
    const { rowCount } = await pool.query(`delete from slots where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  // ── Banners ──────────────────────────────────────────────────────

  const BANNER_UPLOADS = path.resolve(
    process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public"),
    "uploads/banners",
  );

  async function saveBannerImage(dataUrl: string, kind: "ru" | "en"): Promise<string | null> {
    const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(dataUrl);
    if (!m) return null;
    const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
    const buf = Buffer.from(m[3], "base64");
    if (!buf.length || buf.length > 8_000_000) return null;
    await mkdir(BANNER_UPLOADS, { recursive: true });
    const filename = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    await writeFile(path.join(BANNER_UPLOADS, filename), buf);
    return `/uploads/banners/${filename}`;
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
    const { rows } = await pool.query(
      `
      select id, slug, placement, title_ru, title_en, image_ru, image_en,
             href_ru, href_en, sort_order, active, updated_at
      from banners
      where ${where}
      order by placement, sort_order, slug
      `,
      params,
    );
    return { items: rows };
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
    if (!requireStaff(req, reply)) return;
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
    if (!requireStaff(req, reply)) return;
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
    const staff = requireStaff(req, reply);
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


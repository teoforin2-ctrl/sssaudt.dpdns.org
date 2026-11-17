import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin } from "./auth.js";
import { bumpCasinoCache } from "./cache.js";

type PartnerRow = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  cabinet_open: boolean;
  casino_id: string | null;
  casino_slug: string | null;
  casino_name: string | null;
  casino_status: string | null;
  revshare_rate: string | null;
  hot: boolean | null;
  hot_until: string | null;
  has_representative: boolean | null;
  representative_requested_at: string | null;
  clicks_7d: number;
  clicks_30d: number;
  clicks_90d: number;
  bonuses_published: number;
  reviews_count: number;
  final_rating: string | null;
  rank: string | null;
};

function pageParams(query: unknown) {
  const q = (query ?? {}) as { page?: string; limit?: string; q?: string; filter?: string };
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    q: (q.q || "").trim(),
    filter: (q.filter || "").trim(),
  };
}

async function partnerRoleId(pool: Pool) {
  const { rows } = await pool.query<{ id: string }>(
    `select id from roles where code = 'partner_rep' limit 1`,
  );
  return rows[0]?.id ?? null;
}

const partnerSelect = `
  select u.id, u.email, u.display_name, u.is_active, u.created_at,
         (u.revshare_url is not null and length(trim(u.revshare_url)) > 0) as cabinet_open,
         u.casino_id,
         c.slug as casino_slug,
         coalesce(nullif(c.name_ru, ''), c.name) as casino_name,
         c.status as casino_status,
         c.revshare_rate,
         c.hot, c.hot_until,
         c.has_representative, c.representative_requested_at,
         c.final_rating,
         coalesce(cl.clicks_7d, 0) as clicks_7d,
         coalesce(cl.clicks_30d, 0) as clicks_30d,
         coalesce(cl.clicks_90d, 0) as clicks_90d,
         coalesce((
           select count(*)::int from bonuses b where b.casino_id = c.id and b.published = true
         ), 0) as bonuses_published,
         coalesce((
           select count(*)::int from reviews rv where rv.casino_id = c.id
         ), 0) as reviews_count,
         rnk.rn::text as rank
  from users u
  join roles r on r.id = u.role_id
  left join casinos c on c.id = u.casino_id
  left join lateral (
    select
      count(*) filter (where g.created_at >= now() - interval '7 days')::int as clicks_7d,
      count(*) filter (where g.created_at >= now() - interval '30 days')::int as clicks_30d,
      count(*) filter (where g.created_at >= now() - interval '90 days')::int as clicks_90d
    from go_clicks g
    where c.id is not null and (g.casino_id = c.id or g.casino_slug = c.slug)
  ) cl on true
  left join (
    select id, row_number() over (
      order by coalesce(final_rating, editorial_score, 0) desc,
               hot desc, has_representative desc, id
    ) as rn
    from casinos
    where status = 'published'
  ) rnk on rnk.id = c.id
  where r.code = 'partner_rep'
`;

function mapPartner(row: PartnerRow) {
  const rate = row.revshare_rate != null ? Number(row.revshare_rate) : null;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    is_active: row.is_active,
    created_at: row.created_at,
    cabinet_open: row.cabinet_open,
    casino_id: row.casino_id,
    casino_slug: row.casino_slug,
    casino_name: row.casino_name,
    casino_status: row.casino_status,
    revshare_rate: Number.isFinite(rate) ? rate : null,
    hot: Boolean(row.hot),
    hot_until: row.hot_until,
    has_representative: Boolean(row.has_representative),
    representative_requested_at: row.representative_requested_at,
    badge_pending: Boolean(row.representative_requested_at) && !row.has_representative,
    clicks_7d: Number(row.clicks_7d || 0),
    clicks_30d: Number(row.clicks_30d || 0),
    clicks_90d: Number(row.clicks_90d || 0),
    bonuses_published: Number(row.bonuses_published || 0),
    reviews_count: Number(row.reviews_count || 0),
    final_rating: row.final_rating != null ? Number(row.final_rating) : null,
    rank: row.rank != null ? Number(row.rank) : null,
  };
}

export async function registerAdminPartners(app: FastifyInstance, pool: Pool, redis: Redis) {
  app.get("/v1/admin/partners", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { page, limit, offset, q, filter } = pageParams(req.query);
    const params: unknown[] = [];
    const where: string[] = ["true"];

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(u.email ilike $${params.length} or coalesce(u.display_name,'') ilike $${params.length}
          or coalesce(c.slug,'') ilike $${params.length} or coalesce(c.name,'') ilike $${params.length}
          or coalesce(c.name_ru,'') ilike $${params.length})`,
      );
    }
    if (filter === "open") where.push(`u.revshare_url is not null and length(trim(u.revshare_url)) > 0`);
    if (filter === "closed") where.push(`(u.revshare_url is null or length(trim(u.revshare_url)) = 0)`);
    if (filter === "hot") where.push(`c.hot = true`);
    if (filter === "inactive") where.push(`u.is_active = false`);
    if (filter === "badge") {
      where.push(`c.representative_requested_at is not null and coalesce(c.has_representative, false) = false`);
    }

    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const filterParams = params.slice(0, -2);
    const sqlWhere = where.join(" and ");

    const [countRes, listRes, summaryRes, clicksRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from users u
         join roles r on r.id = u.role_id
         left join casinos c on c.id = u.casino_id
         where r.code = 'partner_rep' and ${sqlWhere}`,
        filterParams,
      ),
      pool.query<PartnerRow>(
        `${partnerSelect} and ${sqlWhere}
         order by u.is_active desc, u.created_at desc
         limit ${lim} offset ${off}`,
        params,
      ),
      pool.query<{
        total: string;
        active: string;
        cabinet_open: string;
        hot: string;
        badge_pending: string;
      }>(
        `
        select
          count(*)::text as total,
          count(*) filter (where u.is_active)::text as active,
          count(*) filter (where u.revshare_url is not null and length(trim(u.revshare_url)) > 0)::text as cabinet_open,
          count(*) filter (where c.hot)::text as hot,
          count(*) filter (
            where c.representative_requested_at is not null and coalesce(c.has_representative, false) = false
          )::text as badge_pending
        from users u
        join roles r on r.id = u.role_id
        left join casinos c on c.id = u.casino_id
        where r.code = 'partner_rep'
        `,
      ),
      pool.query<{ n: string }>(
        `
        select count(*)::text as n
        from go_clicks g
        where g.created_at >= now() - interval '30 days'
          and exists (
            select 1
            from users u
            join roles r on r.id = u.role_id
            join casinos c on c.id = u.casino_id
            where r.code = 'partner_rep'
              and (g.casino_id = c.id or g.casino_slug = c.slug)
          )
        `,
      ),
    ]);

    const s = summaryRes.rows[0];
    return {
      items: listRes.rows.map(mapPartner),
      total: Number(countRes.rows[0]?.n ?? 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        active: Number(s?.active ?? 0),
        cabinet_open: Number(s?.cabinet_open ?? 0),
        hot: Number(s?.hot ?? 0),
        badge_pending: Number(s?.badge_pending ?? 0),
        clicks_30d: Number(clicksRes.rows[0]?.n ?? 0),
      },
    };
  });

  app.get("/v1/admin/partners/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query<PartnerRow>(`${partnerSelect} and u.id = $1`, [id]);
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: "not_found" });

    const casinoId = row.casino_id;
    let bonuses: Array<{ id: string; title: string | null; published: boolean; created_at: string }> = [];
    let replies: Array<{
      id: string;
      review_id: string;
      body: string;
      updated_at: string;
      rating: number | null;
    }> = [];

    if (casinoId) {
      const [b, rr] = await Promise.all([
        pool.query<{ id: string; title: string | null; published: boolean; created_at: string }>(
          `select id, title, published, created_at
           from bonuses where casino_id = $1
           order by created_at desc limit 8`,
          [casinoId],
        ),
        pool.query<{
          id: string;
          review_id: string;
          body: string;
          updated_at: string;
          rating: number | null;
        }>(
          `select rr.id, rr.review_id, rr.body, rr.updated_at, r.rating
           from review_replies rr
           join reviews r on r.id = rr.review_id
           where r.casino_id = $1
           order by rr.updated_at desc
           limit 8`,
          [casinoId],
        ),
      ]);
      bonuses = b.rows;
      replies = rr.rows;
    }

    return {
      item: mapPartner(row),
      bonuses,
      replies,
    };
  });

  app.post("/v1/admin/partners", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = z
      .object({
        email: z.string().email().max(200),
        password: z.string().min(8).max(120),
        display_name: z.string().min(1).max(120).optional(),
        casino_id: z.string().uuid().optional(),
        casino_slug: z.string().min(1).max(120).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const roleId = await partnerRoleId(pool);
    if (!roleId) return reply.code(500).send({ error: "missing_role" });

    let casinoId = body.data.casino_id ?? null;
    if (!casinoId && body.data.casino_slug) {
      const c = await pool.query<{ id: string }>(
        `select id from casinos where slug = $1 limit 1`,
        [body.data.casino_slug],
      );
      casinoId = c.rows[0]?.id ?? null;
      if (!casinoId) return reply.code(400).send({ error: "unknown_casino" });
    }
    if (!casinoId) return reply.code(400).send({ error: "casino_required" });

    const taken = await pool.query<{ id: string }>(
      `select u.id from users u
       join roles r on r.id = u.role_id
       where r.code = 'partner_rep' and u.casino_id = $1 and u.is_active = true
       limit 1`,
      [casinoId],
    );
    if (taken.rows[0]) return reply.code(409).send({ error: "casino_has_partner" });

    const hash = await bcrypt.hash(body.data.password, 10);
    try {
      const { rows } = await pool.query<{ id: string }>(
        `
        insert into users (email, display_name, role_id, password_hash, casino_id, is_active)
        values ($1, $2, $3, $4, $5, true)
        returning id
        `,
        [
          body.data.email.trim().toLowerCase(),
          body.data.display_name?.trim() || null,
          roleId,
          hash,
          casinoId,
        ],
      );
      const id = rows[0]?.id;
      if (!id) return reply.code(500).send({ error: "create_failed" });
      const full = await pool.query<PartnerRow>(`${partnerSelect} and u.id = $1`, [id]);
      return { item: mapPartner(full.rows[0]!) };
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "23505") return reply.code(409).send({ error: "email_taken" });
      throw err;
    }
  });

  app.patch("/v1/admin/partners/:id", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        is_active: z.boolean().optional(),
        display_name: z.string().min(1).max(120).nullable().optional(),
        password: z.string().min(8).max(120).optional(),
        casino_id: z.string().uuid().nullable().optional(),
        casino_slug: z.string().min(1).max(120).nullable().optional(),
        clear_revshare: z.boolean().optional(),
        revshare_rate: z.number().min(0).max(100).nullable().optional(),
        hot: z.boolean().optional(),
        confirm_representative: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const existing = await pool.query<{ id: string; casino_id: string | null }>(
      `select u.id, u.casino_id from users u
       join roles r on r.id = u.role_id
       where u.id = $1 and r.code = 'partner_rep'`,
      [id],
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: "not_found" });

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
    if (body.data.password) {
      values.push(await bcrypt.hash(body.data.password, 10));
      fields.push(`password_hash = $${values.length}`);
    }
    if (body.data.clear_revshare) {
      fields.push(`revshare_url = null`);
    }

    let casinoId = existing.rows[0].casino_id;
    if (body.data.casino_id !== undefined) {
      casinoId = body.data.casino_id;
      values.push(body.data.casino_id);
      fields.push(`casino_id = $${values.length}`);
    } else if (body.data.casino_slug !== undefined) {
      if (body.data.casino_slug === null) {
        casinoId = null;
        values.push(null);
        fields.push(`casino_id = $${values.length}`);
      } else {
        const c = await pool.query<{ id: string }>(
          `select id from casinos where slug = $1 limit 1`,
          [body.data.casino_slug],
        );
        if (!c.rows[0]) return reply.code(400).send({ error: "unknown_casino" });
        casinoId = c.rows[0].id;
        values.push(casinoId);
        fields.push(`casino_id = $${values.length}`);
      }
    }

    if (fields.length) {
      values.push(id);
      await pool.query(`update users set ${fields.join(", ")} where id = $${values.length}`, values);
    }

    const casinoFields: string[] = [];
    const casinoValues: unknown[] = [];
    if (casinoId && body.data.revshare_rate !== undefined) {
      casinoValues.push(body.data.revshare_rate);
      casinoFields.push(`revshare_rate = $${casinoValues.length}`);
    }
    if (casinoId && body.data.hot === false) {
      casinoFields.push(`hot = false`);
      casinoFields.push(`hot_until = null`);
      casinoFields.push(`hot_plan = null`);
    }
    if (casinoId && body.data.confirm_representative) {
      casinoFields.push(`has_representative = true`);
      casinoFields.push(`representative_requested_at = null`);
    }
    if (casinoId && casinoFields.length) {
      casinoValues.push(casinoId);
      await pool.query(
        `update casinos set ${casinoFields.join(", ")}, updated_at = now() where id = $${casinoValues.length}`,
        casinoValues,
      );
      await bumpCasinoCache(redis);
    }

    if (!fields.length && !casinoFields.length) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    const full = await pool.query<PartnerRow>(`${partnerSelect} and u.id = $1`, [id]);
    return { item: mapPartner(full.rows[0]!) };
  });
}

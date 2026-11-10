import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requirePartner, requireStaff, type AuthUser } from "./auth.js";
import { bumpCasinoCache } from "./cache.js";
import type { Redis } from "ioredis";

function partnerCasinoId(user: AuthUser, replyCasinoId?: string | null): string | null {
  if (user.isStaff && replyCasinoId) return replyCasinoId;
  return user.casinoId;
}

export async function registerPartner(app: FastifyInstance, pool: Pool, redis: Redis) {
  app.get("/v1/partner/me", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;

    if (!user.casinoId && !user.isStaff) {
      return reply.code(400).send({ error: "no_casino_bound" });
    }

    const casinoId = user.casinoId;
    if (!casinoId) {
      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isStaff: user.isStaff,
          casinoId: null,
        },
        casino: null,
      };
    }

    const { rows } = await pool.query(
      `
      select id, slug, name, name_ru, name_en, logo_url, status, published,
             description_ru, description_en,
             has_representative, representative_requested_at, hot,
             final_rating, editorial_score, player_score
      from casinos where id = $1
      `,
      [casinoId],
    );
    const c = rows[0];
    if (!c) return reply.code(404).send({ error: "casino_not_found" });


    const { rows: counts } = await pool.query<{
      bonuses: string;
      reviews: string;
      pending_reviews: string;
    }>(
      `
      select
        (select count(*)::text from bonuses b where b.casino_id = $1) as bonuses,
        (select count(*)::text from reviews r where r.casino_id = $1 and r.status = 'approved') as reviews,
        (select count(*)::text from reviews r where r.casino_id = $1 and r.status = 'pending') as pending_reviews
      `,
      [casinoId],
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isStaff: user.isStaff,
        casinoId: user.casinoId,
      },
      casino: {
        id: c.id,
        slug: c.slug,
        name: c.name_ru || c.name,
        logoUrl: c.logo_url,
        descriptionRu: c.description_ru,
        descriptionEn: c.description_en,
        status: c.status,
        published: c.published,
        hasRepresentative: c.has_representative,
        representativeRequestedAt: c.representative_requested_at,
        hot: c.hot,
        rating: c.final_rating != null ? Number(c.final_rating) : null,
        editorialScore: c.editorial_score != null ? Number(c.editorial_score) : null,
        playerScore: c.player_score != null ? Number(c.player_score) : null,
      },

      counts: {
        bonuses: Number(counts[0]?.bonuses || 0),
        reviews: Number(counts[0]?.reviews || 0),
        pendingReviews: Number(counts[0]?.pending_reviews || 0),
      },
    };
  });

  /** Partner may edit logo + public descriptions (payments still CMS-only). */
  app.patch("/v1/partner/casino", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const body = z
      .object({
        logoUrl: z.string().trim().max(500).nullable().optional(),

        descriptionRu: z.string().max(8000).nullable().optional(),
        descriptionEn: z.string().max(8000).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.logoUrl !== undefined) {
      values.push(body.data.logoUrl);
      fields.push(`logo_url = $${values.length}`);
    }
    if (body.data.descriptionRu !== undefined) {
      values.push(body.data.descriptionRu);
      fields.push(`description_ru = $${values.length}`);
    }
    if (body.data.descriptionEn !== undefined) {
      values.push(body.data.descriptionEn);
      fields.push(`description_en = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "nothing_to_update" });

    values.push(user.casinoId);
    const { rows } = await pool.query(
      `
      update casinos set ${fields.join(", ")}, updated_at = now()
      where id = $${values.length}
      returning id, slug, logo_url, description_ru, description_en
      `,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    return {
      item: {
        id: rows[0].id,
        slug: rows[0].slug,
        logoUrl: rows[0].logo_url,
        descriptionRu: rows[0].description_ru,
        descriptionEn: rows[0].description_en,
      },
    };
  });

  app.post("/v1/partner/representative/request", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const { rows } = await pool.query(
      `
      update casinos set
        representative_requested_at = coalesce(representative_requested_at, now()),
        representative_requested_by = coalesce(representative_requested_by, $2)
      where id = $1
      returning id, has_representative, representative_requested_at
      `,
      [user.casinoId, user.id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return {
      requested: true,
      hasRepresentative: rows[0].has_representative,
      requestedAt: rows[0].representative_requested_at,
    };
  });

  app.get("/v1/partner/bonuses", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    const q = (req.query ?? {}) as { casinoId?: string };
    const casinoId = partnerCasinoId(user, q.casinoId);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const { rows } = await pool.query(
      `
      select id, title, title_ru, title_en, promo_code, type, amount_or_percent,
             wager, status, published, checked_by_editor, created_at
      from bonuses
      where casino_id = $1
      order by created_at desc
      limit 100
      `,
      [casinoId],
    );
    return { items: rows };
  });

  app.post("/v1/partner/bonuses", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    const body = z
      .object({
        title: z.string().min(1).max(300),
        title_ru: z.string().max(300).optional(),
        promo_code: z.string().max(100).nullable().optional(),
        type: z.string().max(80).nullable().optional(),
        amount_or_percent: z.string().max(80).nullable().optional(),
        wager: z.string().max(40).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows } = await pool.query(
      `
      insert into bonuses (
        casino_id, title, title_ru, title_en, promo_code, type,
        amount_or_percent, wager, status, published
      ) values ($1,$2,$3,$3,$4,$5,$6,$7,'hidden',false)
      returning *
      `,
      [
        user.casinoId,
        body.data.title,
        body.data.title_ru || body.data.title,
        body.data.promo_code ?? null,
        body.data.type ?? null,
        body.data.amount_or_percent ?? null,
        body.data.wager ?? null,
      ],
    );
    await bumpCasinoCache(redis);
    return reply.code(201).send({ item: rows[0] });
  });

  app.patch("/v1/partner/bonuses/:id", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().min(1).max(300).optional(),
        title_ru: z.string().max(300).nullable().optional(),
        promo_code: z.string().max(100).nullable().optional(),
        type: z.string().max(80).nullable().optional(),
        amount_or_percent: z.string().max(80).nullable().optional(),
        wager: z.string().max(40).nullable().optional(),
        status: z.enum(["active", "hidden"]).optional(),
        published: z.boolean().optional(),
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
    values.push(id, user.casinoId);
    const { rows } = await pool.query(
      `
      update bonuses set ${fields.join(", ")}
      where id = $${values.length - 1} and casino_id = $${values.length}
      returning *
      `,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    return { item: rows[0] };
  });

  app.get("/v1/partner/reviews", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    const q = (req.query ?? {}) as { status?: string; page?: string; limit?: string };
    const casinoId = partnerCasinoId(user, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
    const offset = (page - 1) * limit;
    const params: unknown[] = [casinoId];
    let statusClause = "";
    if (q.status === "pending" || q.status === "approved" || q.status === "rejected") {
      params.push(q.status);
      statusClause = ` and status = $${params.length}`;
    }
    params.push(limit, offset);

    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from reviews where casino_id = $1${statusClause}`,
      params.slice(0, statusClause ? 2 : 1),
    );
    const { rows } = await pool.query(
      `
      select r.id, r.rating, r.body, r.status, r.author_name, r.origin, r.created_at, r.published_at,
             r.reward_group, r.reward_amount_usd, r.reward_status, r.ai_quality_score,
             rr.id as reply_id, rr.body as reply_body, rr.updated_at as reply_updated_at
      from reviews r
      left join review_replies rr on rr.review_id = r.id
      where r.casino_id = $1${statusClause.replace("status =", "r.status =")}

      order by r.created_at desc
      limit $${params.length - 1} offset $${params.length}
      `,
      params,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        status: r.status,
        author_name: r.author_name,
        origin: r.origin,
        created_at: r.created_at,
        published_at: r.published_at,
        reward_group: r.reward_group,
        reward_amount_usd: r.reward_amount_usd,
        reward_status: r.reward_status,
        ai_quality_score: r.ai_quality_score,
        reply: r.reply_id
          ? { id: r.reply_id, body: r.reply_body, updatedAt: r.reply_updated_at }
          : null,
      })),
      total: Number(countRows[0]?.n || 0),
      page,
      limit,
    };
  });

  /** Partner official reply to an approved review (one reply per review). */
  app.put("/v1/partner/reviews/:id/reply", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId && !user?.isStaff) {
      return reply.code(400).send({ error: "no_casino_bound" });
    }
    const { id } = req.params as { id: string };
    const body = z.object({ body: z.string().trim().min(2).max(4000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const casinoId = partnerCasinoId(user!, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const { rows: reviews } = await pool.query(
      `select id, status from reviews where id = $1 and casino_id = $2 limit 1`,
      [id, casinoId],
    );
    if (!reviews[0]) return reply.code(404).send({ error: "not_found" });
    if (reviews[0].status !== "approved") {
      return reply.code(400).send({ error: "review_not_approved" });
    }

    const { rows } = await pool.query(
      `
      insert into review_replies (review_id, author_id, body)
      values ($1, $2, $3)
      on conflict (review_id) do update set
        body = excluded.body,
        author_id = excluded.author_id,
        updated_at = now()
      returning *
      `,
      [id, user!.id, body.data.body],
    );
    return { item: { id: rows[0].id, body: rows[0].body, updatedAt: rows[0].updated_at } };
  });

  app.delete("/v1/partner/reviews/:id/reply", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    const casinoId = partnerCasinoId(user, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(
      `
      delete from review_replies rr
      using reviews r
      where rr.review_id = r.id and r.id = $1 and r.casino_id = $2
      `,
      [id, casinoId],
    );
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });


  /** Admin confirms partner representative badge */
  app.post("/v1/admin/casinos/:id/confirm-representative", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({ confirmed: z.boolean().default(true) })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows } = await pool.query(
      `
      update casinos set
        has_representative = $2,
        representative_requested_at = case when $2 then representative_requested_at else null end
      where id = $1
      returning id, slug, has_representative, representative_requested_at
      `,
      [id, body.data.confirmed],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    return { item: rows[0] };
  });
}

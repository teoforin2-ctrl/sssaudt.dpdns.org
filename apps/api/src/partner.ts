import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { requirePartner, requireStaff, type AuthUser } from "./auth.js";
import { bumpCasinoCache } from "./cache.js";
import { parseImageDataUrl, saveRasterAsWebp } from "./images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC =
  process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public");
const BONUS_IMG_DIR = path.join(WEB_PUBLIC, "uploads", "bonuses");

function partnerCasinoId(user: AuthUser, replyCasinoId?: string | null): string | null {
  if (user.isStaff && replyCasinoId) return replyCasinoId;
  return user.casinoId;
}

async function ensurePartnerSchema(pool: Pool) {
  await pool.query(`alter table users add column if not exists revshare_url text`).catch(() => undefined);
  await pool.query(`alter table casinos add column if not exists revshare_rate numeric(5,2)`).catch(() => undefined);
  await pool.query(`alter table casinos add column if not exists hot_until timestamptz`).catch(() => undefined);
  await pool.query(`alter table casinos add column if not exists hot_plan text`).catch(() => undefined);
  await pool.query(`alter table bonuses add column if not exists terms_ru text`).catch(() => undefined);
  await pool.query(`alter table bonuses add column if not exists image_url text`).catch(() => undefined);
  await pool.query(
    `alter table reviews add column if not exists author_user_id uuid references users(id) on delete set null`,
  ).catch(() => undefined);
  await pool.query(`
    create table if not exists partner_reply_templates (
      id uuid primary key default gen_random_uuid(),
      casino_id uuid not null references casinos(id) on delete cascade,
      user_id uuid references users(id) on delete set null,
      body text not null,
      sort_order smallint not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `).catch(() => undefined);
  await pool.query(`
    create table if not exists casino_rating_snapshots (
      casino_id uuid not null references casinos(id) on delete cascade,
      day date not null default current_date,
      editorial numeric(4,2),
      player numeric(4,2),
      base numeric(4,2),
      final numeric(4,2),
      rank int,
      primary key (casino_id, day)
    )
  `).catch(() => undefined);
  await pool.query(`
    create table if not exists user_notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      type text not null,
      title text not null,
      body text,
      created_at timestamptz not null default now(),
      read_at timestamptz
    )
  `).catch(() => undefined);
}

async function loadRevshareUrl(pool: Pool, userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ revshare_url: string | null }>(
    `select revshare_url from users where id = $1`,
    [userId],
  );
  const url = rows[0]?.revshare_url?.trim() || "";
  return url || null;
}

function cabinetOpen(user: AuthUser, revshareUrl: string | null): boolean {
  return user.isStaff || Boolean(revshareUrl);
}

async function requireOpenCabinet(
  pool: Pool,
  user: AuthUser,
  reply: FastifyReply,
): Promise<boolean> {
  if (user.isStaff) return true;
  const url = await loadRevshareUrl(pool, user.id);
  if (url) return true;
  void reply.code(403).send({ error: "revshare_required" });
  return false;
}

async function snapshotCasino(pool: Pool, casinoId: string) {
  await pool.query(
    `update casinos set hot = false where id = $1 and hot_until is not null and hot_until < now()`,
    [casinoId],
  ).catch(() => undefined);
  const { rows } = await pool.query<{
    editorial_score: string | null;
    player_score: string | null;
    base_rating: string | null;
    final_rating: string | null;
    rank: string | null;
  }>(
    `
    select c.editorial_score, c.player_score, c.base_rating, c.final_rating,
           r.rn::text as rank
    from casinos c
    left join (
      select id, row_number() over (
        order by coalesce(final_rating, editorial_score, 0) desc,
                 hot desc, has_representative desc, id
      ) as rn
      from casinos
      where status = 'published'
    ) r on r.id = c.id
    where c.id = $1
    `,
    [casinoId],
  );
  const r = rows[0];
  if (!r) return;
  await pool.query(
    `
    insert into casino_rating_snapshots (casino_id, day, editorial, player, base, final, rank)
    values ($1, current_date, $2, $3, $4, $5, $6)
    on conflict (casino_id, day) do update set
      editorial = excluded.editorial,
      player = excluded.player,
      base = excluded.base,
      final = excluded.final,
      rank = excluded.rank
    `,
    [
      casinoId,
      r.editorial_score != null ? Number(r.editorial_score) : null,
      r.player_score != null ? Number(r.player_score) : null,
      r.base_rating != null ? Number(r.base_rating) : null,
      r.final_rating != null ? Number(r.final_rating) : null,
      r.rank != null ? Number(r.rank) : null,
    ],
  );
}

async function saveBonusImage(dataUrl: string, bonusId: string): Promise<string | null> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed || parsed.ext === "svg") return null;
  await mkdir(BONUS_IMG_DIR, { recursive: true });
  return saveRasterAsWebp({
    dir: BONUS_IMG_DIR,
    basename: `${bonusId}-${Date.now().toString(36)}`,
    buf: parsed.buf,
    publicPathPrefix: "/uploads/bonuses",
  });
}

const bonusFields = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(8000).nullable().optional(),
  terms: z.string().max(8000).nullable().optional(),
  promo_code: z.string().max(100).nullable().optional(),
  imageDataUrl: z.string().max(10_000_000).optional(),
});

export async function registerPartner(app: FastifyInstance, pool: Pool, redis: Redis) {
  await ensurePartnerSchema(pool);

  app.get("/v1/partner/me", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;

    const revshareUrl = user.isStaff && !user.casinoId
      ? null
      : await loadRevshareUrl(pool, user.id);
    const open = cabinetOpen(user, revshareUrl);

    if (!user.casinoId && !user.isStaff) {
      return reply.code(400).send({ error: "no_casino_bound" });
    }

    const casinoId = user.casinoId;
    if (!casinoId) {
      return {
        cabinetOpen: open,
        revshareUrl,
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

    if (open) await snapshotCasino(pool, casinoId).catch(() => undefined);

    const { rows } = await pool.query(
      `
      with ranked as (
        select id, row_number() over (
          order by coalesce(final_rating, editorial_score, 0) desc,
                   hot desc, has_representative desc, id
        ) as rn
        from casinos where status = 'published'
      )
      select c.id, c.slug, c.name, c.name_ru, c.name_en, c.logo_url, c.status, c.published,
             c.description_ru, c.description_en, c.partner_url,
             c.has_representative, c.representative_requested_at, c.hot, c.hot_until, c.hot_plan,
             c.revshare_rate, c.final_rating, c.editorial_score, c.player_score, c.base_rating,
             r.rn as rank
      from casinos c
      left join ranked r on r.id = c.id
      where c.id = $1
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
        (select count(*)::text from bonuses b where b.casino_id = $1 and b.published = true) as bonuses,
        (select count(*)::text from reviews rv where rv.casino_id = $1) as reviews,
        (select count(*)::text from reviews rv where rv.casino_id = $1 and rv.status = 'pending') as pending_reviews
      `,
      [casinoId],
    );

    return {
      cabinetOpen: open,
      revshareUrl,
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
        partnerUrl: c.partner_url,
        hasRepresentative: c.has_representative,
        representativeRequestedAt: c.representative_requested_at,
        hot: Boolean(c.hot) && (!c.hot_until || new Date(c.hot_until) > new Date()),
        hotUntil: c.hot_until,
        hotPlan: c.hot_plan,
        revshareRate: c.revshare_rate != null ? Number(c.revshare_rate) : null,
        rating: c.final_rating != null ? Number(c.final_rating) : null,
        editorialScore: c.editorial_score != null ? Number(c.editorial_score) : null,
        playerScore: c.player_score != null ? Number(c.player_score) : null,
        baseRating: c.base_rating != null ? Number(c.base_rating) : null,
        rank: c.rank != null ? Number(c.rank) : null,
      },
      counts: {
        bonuses: Number(counts[0]?.bonuses || 0),
        reviews: Number(counts[0]?.reviews || 0),
        pendingReviews: Number(counts[0]?.pending_reviews || 0),
      },
    };
  });

  app.patch("/v1/partner/revshare", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    const body = z.object({ url: z.string().trim().url().max(1000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_url" });
    await pool.query(`update users set revshare_url = $2, updated_at = now() where id = $1`, [
      user.id,
      body.data.url,
    ]);
    return { ok: true, revshareUrl: body.data.url, cabinetOpen: true };
  });

  app.get("/v1/partner/dashboard", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const casinoId = partnerCasinoId(user, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const q = (req.query ?? {}) as { clickDays?: string };
    const clickDays = [7, 30, 90].includes(Number(q.clickDays)) ? Number(q.clickDays) : 30;

    await snapshotCasino(pool, casinoId).catch(() => undefined);

    const { rows: casinoRows } = await pool.query<{ partner_url: string | null }>(
      `select partner_url from casinos where id = $1`,
      [casinoId],
    );
    const trackingOn = Boolean(casinoRows[0]?.partner_url?.trim());

    const { rows: clickRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from go_clicks
       where created_at >= now() - ($2 || ' days')::interval
         and (casino_id = $1 or casino_slug = (select slug from casinos where id = $1))`,
      [casinoId, String(clickDays)],
    );

    const { rows: snaps } = await pool.query<{
      day: string;
      editorial: string | null;
      player: string | null;
      base: string | null;
      final: string | null;
      rank: number | null;
    }>(
      `select day::text, editorial::text, player::text, base::text, final::text, rank
       from casino_rating_snapshots
       where casino_id = $1 and day >= current_date - 90
       order by day asc`,
      [casinoId],
    );

    return {
      clickDays,
      clicks: trackingOn ? Number(clickRows[0]?.n || 0) : null,
      trackingOn,
      history: snaps.map((s) => ({
        day: s.day.slice(0, 10),
        editorial: s.editorial != null ? Number(s.editorial) : null,
        player: s.player != null ? Number(s.player) : null,
        base: s.base != null ? Number(s.base) : null,
        final: s.final != null ? Number(s.final) : null,
        rank: s.rank,
      })),
    };
  });

  app.post("/v1/partner/hot", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const body = z.object({ plan: z.enum(["month", "year"]) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const interval = body.data.plan === "year" ? "1 year" : "1 month";
    const { rows } = await pool.query(
      `
      update casinos set
        hot = true,
        hot_plan = $2,
        hot_until = now() + $3::interval,
        updated_at = now()
      where id = $1
      returning hot, hot_until, hot_plan
      `,
      [user.casinoId, body.data.plan, interval],
    );
    await bumpCasinoCache(redis);
    return { item: rows[0] };
  });

  app.patch("/v1/partner/casino", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;

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
    if (!(await requireOpenCabinet(pool, user, reply))) return;

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

  app.get("/v1/partner/reply-templates", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const casinoId = partnerCasinoId(user, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    const { rows } = await pool.query(
      `select id, body, sort_order, updated_at from partner_reply_templates
       where casino_id = $1 order by sort_order, created_at limit 6`,
      [casinoId],
    );
    return { items: rows, max: 6 };
  });

  app.post("/v1/partner/reply-templates", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const body = z.object({ body: z.string().trim().min(2).max(2000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows: n } = await pool.query<{ n: string }>(
      `select count(*)::text as n from partner_reply_templates where casino_id = $1`,
      [user.casinoId],
    );
    if (Number(n[0]?.n || 0) >= 6) return reply.code(400).send({ error: "template_limit" });
    const { rows } = await pool.query(
      `insert into partner_reply_templates (casino_id, user_id, body)
       values ($1,$2,$3) returning id, body, sort_order, updated_at`,
      [user.casinoId, user.id, body.data.body],
    );
    return reply.code(201).send({ item: rows[0] });
  });

  app.patch("/v1/partner/reply-templates/:id", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const { id } = req.params as { id: string };
    const body = z.object({ body: z.string().trim().min(2).max(2000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows } = await pool.query(
      `update partner_reply_templates set body = $3, updated_at = now()
       where id = $1 and casino_id = $2 returning id, body, sort_order, updated_at`,
      [id, user.casinoId, body.data.body],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.delete("/v1/partner/reply-templates/:id", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(
      `delete from partner_reply_templates where id = $1 and casino_id = $2`,
      [id, user.casinoId],
    );
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.get("/v1/partner/bonuses", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const q = (req.query ?? {}) as { casinoId?: string };
    const casinoId = partnerCasinoId(user, q.casinoId);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const { rows } = await pool.query(
      `
      select id, title, title_ru, title_en, promo_code, type, amount_or_percent,
             wager, status, published, checked_by_editor, created_at,
             description_ru, terms_ru, image_url
      from bonuses
      where casino_id = $1
      order by created_at desc
      limit 100
      `,
      [casinoId],
    );
    return {
      items: rows,
      publishedCount: rows.filter((r) => r.published).length,
      maxPublished: 20,
    };
  });

  app.post("/v1/partner/bonuses", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const body = bonusFields.extend({ title: z.string().min(1).max(300) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: n } = await pool.query<{ n: string }>(
      `select count(*)::text as n from bonuses where casino_id = $1 and published = true`,
      [user.casinoId],
    );
    if (Number(n[0]?.n || 0) >= 20) return reply.code(400).send({ error: "bonus_limit" });

    const { rows } = await pool.query(
      `
      insert into bonuses (
        casino_id, title, title_ru, title_en, promo_code,
        description_ru, terms_ru, status, published
      ) values ($1,$2,$2,$2,$3,$4,$5,'active',true)
      returning *
      `,
      [
        user.casinoId,
        body.data.title,
        body.data.promo_code ?? null,
        body.data.description ?? null,
        body.data.terms ?? null,
      ],
    );
    const item = rows[0];
    if (body.data.imageDataUrl) {
      const imageUrl = await saveBonusImage(body.data.imageDataUrl, item.id).catch(() => null);
      if (imageUrl) {
        const { rows: upd } = await pool.query(
          `update bonuses set image_url = $2 where id = $1 returning *`,
          [item.id, imageUrl],
        );
        Object.assign(item, upd[0]);
      }
    }
    await bumpCasinoCache(redis);
    return reply.code(201).send({ item });
  });

  app.patch("/v1/partner/bonuses/:id", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const { id } = req.params as { id: string };
    const body = bonusFields.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const d = body.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (d.title !== undefined) {
      values.push(d.title);
      fields.push(`title = $${values.length}`);
      values.push(d.title);
      fields.push(`title_ru = $${values.length}`);
    }
    if (d.description !== undefined) {
      values.push(d.description);
      fields.push(`description_ru = $${values.length}`);
    }
    if (d.terms !== undefined) {
      values.push(d.terms);
      fields.push(`terms_ru = $${values.length}`);
    }
    if (d.promo_code !== undefined) {
      values.push(d.promo_code);
      fields.push(`promo_code = $${values.length}`);
    }
    if (d.imageDataUrl) {
      const imageUrl = await saveBonusImage(d.imageDataUrl, id);
      if (imageUrl) {
        values.push(imageUrl);
        fields.push(`image_url = $${values.length}`);
      }
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

  app.delete("/v1/partner/bonuses/:id", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId) return reply.code(400).send({ error: "no_casino_bound" });
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(
      `delete from bonuses where id = $1 and casino_id = $2`,
      [id, user.casinoId],
    );
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    await bumpCasinoCache(redis);
    return { ok: true };
  });

  app.get("/v1/partner/reviews", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    if (!(await requireOpenCabinet(pool, user, reply))) return;
    const q = (req.query ?? {}) as { sort?: string; page?: string; limit?: string };
    const casinoId = partnerCasinoId(user, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
    const offset = (page - 1) * limit;
    const sort =
      q.sort === "old"
        ? "r.created_at asc"
        : q.sort === "rating_asc"
          ? "r.rating asc, r.created_at desc"
          : q.sort === "rating_desc"
            ? "r.rating desc, r.created_at desc"
            : "r.created_at desc";

    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from reviews where casino_id = $1`,
      [casinoId],
    );
    const { rows } = await pool.query(
      `
      select r.id, r.rating, r.body, r.status, r.author_name, r.origin, r.created_at, r.published_at,
             r.reward_group, r.reward_amount_usd, r.reward_status, r.ai_quality_score,
             rr.id as reply_id, rr.body as reply_body, rr.updated_at as reply_updated_at
      from reviews r
      left join review_replies rr on rr.review_id = r.id
      where r.casino_id = $1
      order by ${sort}
      limit $2 offset $3
      `,
      [casinoId, limit, offset],
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

  app.put("/v1/partner/reviews/:id/reply", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user?.casinoId && !user?.isStaff) {
      return reply.code(400).send({ error: "no_casino_bound" });
    }
    if (!(await requireOpenCabinet(pool, user!, reply))) return;
    const { id } = req.params as { id: string };
    const body = z.object({ body: z.string().trim().min(2).max(4000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const casinoId = partnerCasinoId(user!, null);
    if (!casinoId) return reply.code(400).send({ error: "no_casino_bound" });

    const { rows: reviews } = await pool.query<{
      id: string;
      status: string;
      author_user_id: string | null;
    }>(
      `select id, status, author_user_id from reviews where id = $1 and casino_id = $2 limit 1`,
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

    const { rows: casinoName } = await pool.query<{ name: string }>(
      `select coalesce(name_ru, name) as name from casinos where id = $1`,
      [casinoId],
    );
    const brand = casinoName[0]?.name || "казино";
    if (reviews[0].author_user_id) {
      await pool.query(
        `insert into user_notifications (user_id, type, title, body)
         values ($1, 'review_reply', $2, $3)`,
        [
          reviews[0].author_user_id,
          `Официальный представитель ${brand} оставил ответ на ваш отзыв`,
          body.data.body.slice(0, 400),
        ],
      ).catch(() => undefined);
    }

    return { item: { id: rows[0].id, body: rows[0].body, updatedAt: rows[0].updated_at } };
  });

  app.delete("/v1/partner/reviews/:id/reply", async (req, reply) => {
    const user = requirePartner(req, reply);
    if (!user) return;
    if (!(await requireOpenCabinet(pool, user, reply))) return;
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

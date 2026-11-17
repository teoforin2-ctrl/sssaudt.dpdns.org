import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { z } from "zod";
import { requireUser } from "./auth.js";
import { levelFromXp, xpIntoLevel } from "./gamification.js";
import {
  bindPlayerToUser,
  ensurePlayerAccountSchema,
  playerIdForUser,
} from "./player-bind.js";

export async function registerAccount(app: FastifyInstance, pool: Pool) {
  await ensurePlayerAccountSchema(pool);

  app.post("/v1/me/bind-player", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const body = z.object({ playerId: z.string().uuid().optional() }).safeParse(req.body ?? {});
    const guest = body.success ? body.data.playerId ?? null : null;
    const playerId = await bindPlayerToUser(pool, user.id, guest);
    return { playerId };
  });

  app.get("/v1/me/account", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const playerId = await bindPlayerToUser(pool, user.id, null);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      playerId,
    };
  });

  app.patch("/v1/me", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const body = z
      .object({
        displayName: z.string().trim().min(2).max(80).optional(),
        password: z.string().min(6).max(200).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.displayName) {
      values.push(body.data.displayName);
      fields.push(`display_name = $${values.length}`);
    }
    if (body.data.password) {
      values.push(await bcrypt.hash(body.data.password, 10));
      fields.push(`password_hash = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(user.id);
    const { rows } = await pool.query<{ display_name: string | null; email: string }>(
      `update users set ${fields.join(", ")} where id = $${values.length}
       returning email, display_name`,
      values,
    );
    const row = rows[0];
    return {
      user: {
        id: user.id,
        email: row?.email || user.email,
        displayName: row?.display_name ?? user.displayName,
      },
    };
  });

  app.get("/v1/me/reviews", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const playerId = await playerIdForUser(pool, user.id);
    const { rows } = await pool.query(
      `
      select r.id, r.rating, r.body, r.status, r.created_at, r.published_at,
             r.reward_status, r.reward_amount_usd, r.wallet_address,
             c.slug as casino_slug,
             coalesce(nullif(c.name_ru, ''), c.name) as casino_name,
             rr.body as reply_body, rr.updated_at as reply_updated_at
      from reviews r
      join casinos c on c.id = r.casino_id
      left join review_replies rr on rr.review_id = r.id
      where r.author_user_id = $1
         or ($2::uuid is not null and r.player_id = $2)
      order by r.created_at desc
      limit 50
      `,
      [user.id, playerId],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        status: r.status,
        createdAt: r.created_at,
        publishedAt: r.published_at,
        rewardStatus: r.reward_status,
        rewardAmountUsd: r.reward_amount_usd != null ? Number(r.reward_amount_usd) : null,
        walletAddress: r.wallet_address,
        casinoSlug: r.casino_slug,
        casinoName: r.casino_name,
        reply: r.reply_body
          ? { body: r.reply_body, updatedAt: r.reply_updated_at }
          : null,
      })),
    };
  });

  app.get("/v1/me/rewards", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const playerId = await playerIdForUser(pool, user.id);
    const { rows } = await pool.query(
      `
      select r.id, r.reward_status, r.reward_amount_usd, r.wallet_address, r.reward_group,
             r.tx_hash, r.created_at,
             c.slug as casino_slug,
             coalesce(nullif(c.name_ru, ''), c.name) as casino_name
      from reviews r
      join casinos c on c.id = r.casino_id
      where (r.author_user_id = $1 or ($2::uuid is not null and r.player_id = $2))
        and coalesce(r.reward_status, 'none') <> 'none'
      order by r.created_at desc
      limit 50
      `,
      [user.id, playerId],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.reward_status,
        amountUsd: r.reward_amount_usd != null ? Number(r.reward_amount_usd) : null,
        walletAddress: r.wallet_address,
        group: r.reward_group,
        txHash: r.tx_hash,
        createdAt: r.created_at,
        casinoSlug: r.casino_slug,
        casinoName: r.casino_name,
      })),
    };
  });

  app.get("/v1/me/complaints", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      `
      select id, subject, status, casino_slug, casino_name, created_at, updated_at, staff_note
      from complaints
      where author_user_id = $1
         or lower(author_email) = lower($2)
      order by created_at desc
      limit 50
      `,
      [user.id, user.email],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        status: r.status,
        casinoSlug: r.casino_slug,
        casinoName: r.casino_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        staffNote: r.status === "need_info" || r.status === "resolved" ? r.staff_note : null,
      })),
    };
  });

  app.get("/v1/me/progress", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const playerId = await bindPlayerToUser(pool, user.id, null);
    const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
    const lang = locale.startsWith("en") ? "en" : "ru";

    const { rows: prog } = await pool.query(
      `select xp, level, reviews_approved from player_progress where player_id = $1`,
      [playerId],
    ).catch(() => ({ rows: [] as { xp: number; level: number; reviews_approved: number }[] }));
    const xp = Number(prog[0]?.xp || 0);
    const level = Number(prog[0]?.level || levelFromXp(xp) || 1);
    const reviewsApproved = Number(prog[0]?.reviews_approved || 0);

    const { rows: allAch } = await pool.query(
      `select id, title_ru, title_en, description_ru, description_en, sort_order
       from achievements order by sort_order`,
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const { rows: unlocked } = await pool.query(
      `select achievement_id, unlocked_at from player_achievements where player_id = $1`,
      [playerId],
    ).catch(() => ({ rows: [] as { achievement_id: string; unlocked_at: string }[] }));
    const unlockedMap = new Map(unlocked.map((u) => [u.achievement_id, u.unlocked_at]));

    return {
      playerId,
      xp,
      level,
      reviewsApproved,
      intoLevel: xpIntoLevel(xp, level),
      nextLevelXp: level * 100,
      achievements: allAch.map((a) => ({
        id: a.id,
        title: lang === "en" ? a.title_en : a.title_ru,
        description: lang === "en" ? a.description_en : a.description_ru,
        unlockedAt: unlockedMap.get(a.id as string) || null,
      })),
    };
  });

  app.post("/v1/me/notifications/:id/read", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    await pool.query(
      `update user_notifications set read_at = now()
       where id = $1 and user_id = $2 and read_at is null`,
      [id, user.id],
    );
    return { ok: true };
  });
}

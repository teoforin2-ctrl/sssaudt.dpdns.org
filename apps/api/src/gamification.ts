import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

/** XP curve: level N costs N*100 XP from previous. */
export function levelFromXp(xp: number): number {
  let level = 1;
  let need = 100;
  let left = Math.max(0, xp);
  while (left >= need) {
    left -= need;
    level += 1;
    need = level * 100;
  }
  return level;
}

export function xpIntoLevel(xp: number, level: number): number {
  let rem = Math.max(0, xp);
  for (let l = 1; l < level; l++) rem -= l * 100;
  return Math.max(0, rem);
}

export async function grantReviewApprovedXp(
  pool: Pool,
  opts: { playerId: string | null; aiQualityScore: number | null },
): Promise<void> {
  if (!opts.playerId) return;

  const baseXp = 40;
  const qualityBonus = (opts.aiQualityScore ?? 0) >= 80 ? 35 : 0;
  const gain = baseXp + qualityBonus;

  await pool.query(
    `
    insert into player_progress (player_id, xp, level, reviews_approved, updated_at)
    values ($1, $2, 1, 1, now())
    on conflict (player_id) do update set
      xp = player_progress.xp + excluded.xp,
      reviews_approved = player_progress.reviews_approved + 1,
      updated_at = now()
    `,
    [opts.playerId, gain],
  );

  const { rows } = await pool.query<{ xp: number; reviews_approved: number }>(
    `select xp, reviews_approved from player_progress where player_id = $1`,
    [opts.playerId],
  );
  let xp = Number(rows[0]?.xp || 0);
  const reviews = Number(rows[0]?.reviews_approved || 0);
  let level = levelFromXp(xp);
  await pool.query(`update player_progress set level = $2 where player_id = $1`, [
    opts.playerId,
    level,
  ]);

  const unlock: string[] = [];
  if (reviews >= 1) unlock.push("first_review");
  if (reviews >= 5) unlock.push("reviews_5");
  if (reviews >= 20) unlock.push("reviews_20");
  if ((opts.aiQualityScore ?? 0) >= 80) unlock.push("high_quality");
  if (level >= 5) unlock.push("level_5");

  for (const id of unlock) {
    const { rows: ach } = await pool.query<{ xp_reward: number }>(
      `select xp_reward from achievements where id = $1`,
      [id],
    );
    const { rowCount } = await pool.query(
      `
      insert into player_achievements (player_id, achievement_id)
      values ($1, $2)
      on conflict do nothing
      `,
      [opts.playerId, id],
    );
    if (rowCount && Number(ach[0]?.xp_reward || 0) > 0) {
      const bonus = Number(ach[0]!.xp_reward);
      xp += bonus;
      level = levelFromXp(xp);
      await pool.query(
        `
        update player_progress set xp = $2, level = $3, updated_at = now()
        where player_id = $1
        `,
        [opts.playerId, xp, level],
      );
    }
  }
}

export async function registerGamification(app: FastifyInstance, pool: Pool) {
  app.get("/v1/players/:id/progress", async (req) => {
    const { id } = req.params as { id: string };
    const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
    const lang = locale.startsWith("en") ? "en" : "ru";

    const { rows: prog } = await pool.query(
      `select xp, level, reviews_approved from player_progress where player_id = $1`,
      [id],
    );
    const xp = Number(prog[0]?.xp || 0);
    const level = Number(prog[0]?.level || levelFromXp(xp) || 1);
    const reviewsApproved = Number(prog[0]?.reviews_approved || 0);
    const intoLevel = xpIntoLevel(xp, level);
    const nextLevelXp = level * 100;

    const { rows: allAch } = await pool.query(
      `select id, title_ru, title_en, description_ru, description_en, xp_reward, icon, sort_order
       from achievements order by sort_order`,
    );
    const { rows: unlocked } = await pool.query(
      `select achievement_id, unlocked_at from player_achievements where player_id = $1`,
      [id],
    );
    const unlockedMap = new Map(
      unlocked.map((u) => [u.achievement_id as string, u.unlocked_at]),
    );

    return {
      playerId: id,
      xp,
      level,
      reviewsApproved,
      intoLevel,
      nextLevelXp,
      achievements: allAch.map((a) => ({
        id: a.id,
        title: lang === "en" ? a.title_en : a.title_ru,
        description: lang === "en" ? a.description_en : a.description_ru,
        xpReward: a.xp_reward,
        icon: a.icon,
        unlockedAt: unlockedMap.get(a.id as string) || null,
      })),
    };
  });

  app.get("/v1/exclusive-promos", async (req) => {
    const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
    const lang = locale.startsWith("en") ? "en" : "ru";
    const q = (req.query ?? {}) as { playerId?: string; level?: string };
    const playerLevel = Math.max(1, Number(q.level) || 1);

    const { rows } = await pool.query(
      `
      select e.id, e.code, e.title_ru, e.title_en, e.min_level, e.max_claims, e.claims_count,
             e.valid_until, c.slug as casino_slug, c.name as casino_name
      from exclusive_promos e
      left join casinos c on c.id = e.casino_id
      where e.active = true
        and (e.valid_until is null or e.valid_until > now())
        and e.min_level <= $1
        and (e.max_claims is null or e.claims_count < e.max_claims)
      order by e.min_level asc, e.created_at desc
      limit 50
      `,
      [playerLevel],
    );

    let claimed = new Set<string>();
    if (q.playerId) {
      const { rows: claims } = await pool.query(
        `select promo_id::text from exclusive_promo_claims where player_id = $1`,
        [q.playerId],
      );
      claimed = new Set(claims.map((c) => c.promo_id as string));
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        code: claimed.has(r.id as string) ? r.code : null,
        title: lang === "en" ? r.title_en : r.title_ru,
        minLevel: r.min_level,
        casinoSlug: r.casino_slug,
        casinoName: r.casino_name,
        claimed: claimed.has(r.id as string),
        validUntil: r.valid_until,
      })),
    };
  });

  app.post("/v1/exclusive-promos/:id/claim", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ playerId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: prog } = await pool.query<{ level: number }>(
      `select level from player_progress where player_id = $1`,
      [body.data.playerId],
    );
    const level = Number(prog[0]?.level || 1);

    const { rows: promo } = await pool.query(
      `
      select id, code, min_level, max_claims, claims_count, active, valid_until
      from exclusive_promos where id = $1
      `,
      [id],
    );
    const p = promo[0];
    if (!p || !p.active) return reply.code(404).send({ error: "not_found" });
    if (p.valid_until && new Date(p.valid_until) < new Date()) {
      return reply.code(400).send({ error: "expired" });
    }
    if (level < Number(p.min_level)) return reply.code(403).send({ error: "level_too_low" });
    if (p.max_claims != null && Number(p.claims_count) >= Number(p.max_claims)) {
      return reply.code(400).send({ error: "sold_out" });
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rowCount } = await client.query(
        `
        insert into exclusive_promo_claims (promo_id, player_id)
        values ($1, $2)
        on conflict do nothing
        `,
        [id, body.data.playerId],
      );
      if (rowCount) {
        await client.query(
          `update exclusive_promos set claims_count = claims_count + 1 where id = $1`,
          [id],
        );
      }
      await client.query("commit");
    }
    catch (err) {
      await client.query("rollback");
      throw err;
    }
    finally {
      client.release();
    }

    return { ok: true, code: p.code };
  });
}

import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { z } from "zod";
import {
  calcBaseRating,
  calcFinalRating,
  moderateReviewText,
  rollRewardB,
  isTrc20Address,
  type RewardGroup,
} from "@x-reviewer/shared";
import { bumpCasinoCache } from "./cache.js";
import { loadRewardSettings } from "./reward-settings.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const playedEnum = z.enum(["lt_week", "w1_m1", "m1_y1", "gt_year"]);
const modesEnum = z.enum(["m1_5", "m6_10", "m10_plus"]);

function bodyHash(body: string) {
  return createHash("sha256").update(body.trim().toLowerCase()).digest("hex");
}

async function ensurePlayer(
  pool: Pool,
  opts: { playerId?: string | null; cookieId?: string | null; abGroup?: RewardGroup | null },
): Promise<{ id: string; abGroup: RewardGroup }> {
  if (opts.playerId) {
    const { rows } = await pool.query<{ id: string; ab_group: RewardGroup | null }>(
      `select id, ab_group from players where id = $1`,
      [opts.playerId],
    );
    if (rows[0]) {
      let ab = rows[0].ab_group;
      if (!ab) {
        ab = opts.abGroup === "B" ? "B" : opts.abGroup === "A" ? "A" : Math.random() < 0.5 ? "A" : "B";
        await pool.query(
          `update players set ab_group = $2, ab_assigned_at = coalesce(ab_assigned_at, now()) where id = $1`,
          [rows[0].id, ab],
        );
      }
      return { id: rows[0].id, abGroup: ab };
    }
  }

  if (opts.cookieId) {
    const { rows } = await pool.query<{ id: string; ab_group: RewardGroup | null }>(
      `select id, ab_group from players where cookie_id = $1`,
      [opts.cookieId],
    );
    if (rows[0]) {
      let ab = rows[0].ab_group;
      if (!ab) {
        ab = opts.abGroup === "B" ? "B" : opts.abGroup === "A" ? "A" : Math.random() < 0.5 ? "A" : "B";
        await pool.query(
          `update players set ab_group = $2, ab_assigned_at = coalesce(ab_assigned_at, now()) where id = $1`,
          [rows[0].id, ab],
        );
      }
      return { id: rows[0].id, abGroup: ab };
    }
  }

  const ab: RewardGroup =
    opts.abGroup === "A" || opts.abGroup === "B"
      ? opts.abGroup
      : Math.random() < 0.5
        ? "A"
        : "B";
  const cookieId = opts.cookieId || randomUUID();
  const { rows } = await pool.query<{ id: string; ab_group: RewardGroup | null }>(
    `
    insert into players (cookie_id, ab_group, ab_assigned_at)
    values ($1, $2, now())
    on conflict (cookie_id) do update
      set ab_group = coalesce(players.ab_group, excluded.ab_group),
          ab_assigned_at = coalesce(players.ab_assigned_at, excluded.ab_assigned_at)
    returning id, ab_group
    `,
    [cookieId, ab],
  );
  const row = rows[0];
  if (!row) throw new Error("player_create_failed");
  return { id: row.id, abGroup: row.ab_group || ab };
}

export async function recalcCasinoRatings(pool: Pool, casinoId: string) {
  const { rows: casinoRows } = await pool.query<{
    editorial_score: string | null;
    hot: boolean;
  }>(`select editorial_score, hot from casinos where id = $1`, [casinoId]);
  const c = casinoRows[0];
  if (!c) return;

  const { rows: agg } = await pool.query<{ avg: string | null; n: string }>(
    `
    select avg(rating)::text as avg, count(*)::text as n
    from reviews
    where casino_id = $1 and status = 'approved' and coalesce(origin, 'ugc') = 'ugc'
    `,
    [casinoId],
  );
  const n = Number(agg[0]?.n || 0);
  const avg = agg[0]?.avg != null ? Number(agg[0].avg) : null;
  const playerScore = n >= 5 && avg != null ? Math.round(avg * 10) / 10 : null;
  const editorial = Number(c.editorial_score ?? 0);
  const base = calcBaseRating(editorial, playerScore);
  const final = calcFinalRating(base, Boolean(c.hot));

  await pool.query(
    `
    update casinos set
      player_score = $2,
      base_rating = $3,
      final_rating = $4
    where id = $1
    `,
    [casinoId, playerScore, Number(base.toFixed(2)), Number(final.toFixed(2))],
  );
}

async function rateLimitOk(
  redis: Redis,
  playerId: string,
  limitPerHour: number,
): Promise<boolean> {
  const key = `review_mod_rl:${playerId}`;
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    return n <= limitPerHour;
  } catch {
    return true;
  }
}

export async function registerReviews(app: FastifyInstance, pool: Pool, redis: Redis) {
  app.get("/v1/reward-settings", async () => {
    const s = await loadRewardSettings(pool);
    return {
      enabled: s.enabled,
      currency: s.currency,
      network: s.network,
      explorerTxTemplate: s.explorerTxTemplate,
      fixedAmountA: s.fixedAmountA,
      rewardPreviewB: s.rewardPreviewB,
      minReviewChars: s.minReviewChars,
      payoutMode: s.payoutMode,
    };
  });

  app.post("/v1/players/ensure", async (req, reply) => {
    const body = z
      .object({
        playerId: z.string().uuid().optional(),
        cookieId: z.string().min(8).max(120).optional(),
        abGroup: z.enum(["A", "B"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const player = await ensurePlayer(pool, body.data);
    return { playerId: player.id, abGroup: player.abGroup, cookieId: body.data.cookieId || null };
  });

  app.post("/v1/reviews/moderate", async (req, reply) => {
    const settings = await loadRewardSettings(pool);
    const body = z
      .object({
        casinoSlug: z.string().min(1).max(120),
        playerId: z.string().uuid().optional(),
        cookieId: z.string().min(8).max(120).optional(),
        abGroup: z.enum(["A", "B"]).optional(),
        locale: z.enum(["ru", "en"]).default("ru"),
        rating: z.number().int().min(1).max(5),
        body: z.string().min(50).max(20000),
        playedDuration: playedEnum,
        issuesRegistration: z.boolean(),
        issuesDeposit: z.boolean(),
        issuesWithdraw: z.boolean(),
        modesTried: modesEnum,
        captchaToken: z.string().min(1),
        authorName: z.string().max(80).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    if (body.data.body.trim().length < settings.minReviewChars) {
      return reply.code(400).send({
        error: "body_too_short",
        min: settings.minReviewChars,
      });
    }
    if (body.data.captchaToken !== "mock-ok") {
      return reply.code(400).send({ error: "captcha_failed" });
    }
    if (!settings.enabled) {
      return reply.code(503).send({ error: "rewards_disabled" });
    }

    const player = await ensurePlayer(pool, body.data);
    if (!(await rateLimitOk(redis, player.id, settings.rateLimitPerHour))) {
      return reply.code(429).send({ error: "rate_limited", playerId: player.id, abGroup: player.abGroup });
    }

    await sleep(settings.moderationDelayMs);

    const { rows: casinoRows } = await pool.query<{ id: string; name: string }>(
      `select id, name from casinos where slug = $1 and status = 'published' limit 1`,
      [body.data.casinoSlug],
    );
    if (!casinoRows[0]) return reply.code(404).send({ error: "casino_not_found" });
    const casino = casinoRows[0];

    const { rows: existing } = await pool.query<{ body: string }>(
      `
      select body from reviews
      where casino_id = $1 and status = 'approved'
      order by published_at desc nulls last
      limit 80
      `,
      [casino.id],
    );

    const verdict = moderateReviewText(
      body.data.body,
      existing.map((r) => r.body),
    );

    if (!verdict.ok) {
      const { rows } = await pool.query(
        `
        insert into reviews (
          casino_id, rating, body, status, player_id, played_duration,
          issues_registration, issues_deposit, issues_withdraw, modes_tried,
          ai_reject_reasons, reward_group, reward_status, locale, origin, is_seed,
          author_name, body_hash
        ) values (
          $1,$2,$3,'rejected',$4,$5,$6,$7,$8,$9,$10,$11,'none',$12,'ugc',false,$13,$14
        )
        returning id
        `,
        [
          casino.id,
          body.data.rating,
          body.data.body.trim(),
          player.id,
          body.data.playedDuration,
          body.data.issuesRegistration,
          body.data.issuesDeposit,
          body.data.issuesWithdraw,
          body.data.modesTried,
          verdict.reasons,
          player.abGroup,
          body.data.locale,
          body.data.authorName || null,
          bodyHash(body.data.body),
        ],
      );
      return {
        status: "rejected" as const,
        reviewId: rows[0].id as string,
        playerId: player.id,
        abGroup: player.abGroup,
        reasons: verdict.reasons,
      };
    }

    const rewardAmount = player.abGroup === "A" ? settings.fixedAmountA : null;
    const hash = bodyHash(body.data.body);

    let reviewId: string;
    try {
      const { rows } = await pool.query(
        `
        insert into reviews (
          casino_id, rating, body, status, player_id, played_duration,
          issues_registration, issues_deposit, issues_withdraw, modes_tried,
          ai_quality_score, reward_group, reward_amount_usd, reward_status,
          locale, origin, is_seed, author_name, body_hash, published_at
        ) values (
          $1,$2,$3,'approved',$4,$5,$6,$7,$8,$9,$10,$11,$12,
          $13,$14,'ugc',false,$15,$16,now()
        )
        returning id
        `,
        [
          casino.id,
          body.data.rating,
          body.data.body.trim(),
          player.id,
          body.data.playedDuration,
          body.data.issuesRegistration,
          body.data.issuesDeposit,
          body.data.issuesWithdraw,
          body.data.modesTried,
          verdict.qualityScore,
          player.abGroup,
          rewardAmount,
          player.abGroup === "A" ? "pending" : "none",
          body.data.locale,
          body.data.authorName || null,
          hash,
        ],
      );
      reviewId = rows[0].id as string;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        return reply.code(409).send({ error: "duplicate_review", playerId: player.id, abGroup: player.abGroup });
      }
      throw err;
    }

    await recalcCasinoRatings(pool, casino.id);
    await bumpCasinoCache(redis);

    return {
      status: "approved" as const,
      reviewId,
      playerId: player.id,
      abGroup: player.abGroup,
      rewardAmountUsd: rewardAmount,
      qualityScore: verdict.qualityScore,
    };
  });

  app.post("/v1/rewards/spin", async (req, reply) => {
    const settings = await loadRewardSettings(pool);
    const body = z
      .object({
        reviewId: z.string().uuid(),
        playerId: z.string().uuid(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows } = await pool.query<{
      id: string;
      player_id: string | null;
      reward_group: string | null;
      reward_amount_usd: string | null;
      reward_status: string;
      status: string;
    }>(`select * from reviews where id = $1`, [body.data.reviewId]);
    const r = rows[0];
    if (!r || r.status !== "approved") return reply.code(404).send({ error: "not_found" });
    if (r.player_id !== body.data.playerId) return reply.code(403).send({ error: "forbidden" });
    if (r.reward_group !== "B") return reply.code(400).send({ error: "not_group_b" });
    if (r.reward_amount_usd != null) {
      return { amountUsd: Number(r.reward_amount_usd), alreadySpun: true };
    }

    const amount = rollRewardB(settings.wheelTable);
    await pool.query(
      `update reviews set reward_amount_usd = $2, reward_status = 'pending' where id = $1`,
      [r.id, amount],
    );
    return { amountUsd: amount, alreadySpun: false };
  });

  app.post("/v1/rewards/payout", async (req, reply) => {
    const settings = await loadRewardSettings(pool);
    const body = z
      .object({
        reviewId: z.string().uuid(),
        playerId: z.string().uuid(),
        walletAddress: z.string().min(10).max(80),
        forceFail: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!isTrc20Address(body.data.walletAddress)) {
      return reply.code(400).send({ error: "invalid_wallet" });
    }

    const { rows } = await pool.query<{
      id: string;
      casino_id: string;
      player_id: string | null;
      reward_amount_usd: string | null;
      reward_status: string;
      reward_group: string | null;
      tx_hash: string | null;
      status: string;
    }>(`select * from reviews where id = $1`, [body.data.reviewId]);
    const r = rows[0];
    if (!r || r.status !== "approved") return reply.code(404).send({ error: "not_found" });
    if (r.player_id !== body.data.playerId) return reply.code(403).send({ error: "forbidden" });
    if (r.reward_amount_usd == null) return reply.code(400).send({ error: "no_reward_amount" });

    // Idempotent success
    if (r.reward_status === "paid" && r.tx_hash) {
      return {
        status: "paid" as const,
        amountUsd: Number(r.reward_amount_usd),
        txHash: r.tx_hash,
        alreadyPaid: true,
      };
    }

    const wallet = body.data.walletAddress.trim();

    if (settings.blockDuplicateWallet) {
      const { rows: dup } = await pool.query<{ n: string }>(
        `
        select count(*)::text as n from reviews
        where wallet_address = $1 and reward_status = 'paid' and id <> $2
        `,
        [wallet, r.id],
      );
      if (Number(dup[0]?.n || 0) > 0) {
        return reply.code(409).send({ error: "wallet_already_used" });
      }
    }

    const { rows: paidCount } = await pool.query<{ n: string }>(
      `
      select count(*)::text as n from reviews
      where player_id = $1 and casino_id = $2 and reward_status = 'paid' and id <> $3
      `,
      [body.data.playerId, r.casino_id, r.id],
    );
    if (Number(paidCount[0]?.n || 0) >= settings.maxPaidReviewsPerPlayerCasino) {
      return reply.code(429).send({ error: "player_casino_reward_limit" });
    }

    await sleep(settings.payoutDelayMs);

    if (settings.payoutMode === "provider") {
      // TODO(provider): real crypto payout adapter
      return reply.code(501).send({ error: "provider_not_configured" });
    }

    const fail =
      body.data.forceFail === true ||
      (typeof (req.query as { payout?: string }).payout === "string" &&
        (req.query as { payout?: string }).payout === "fail");

    if (fail) {
      await pool.query(
        `
        insert into reward_intents (review_id, player_id, ab_group, amount_usd, wallet_address, status, error_message, updated_at)
        values ($1,$2,$3,$4,$5,'failed',$6,now())
        `,
        [
          r.id,
          body.data.playerId,
          r.reward_group || "A",
          Number(r.reward_amount_usd),
          wallet,
          "mock_fail",
        ],
      );
      await pool.query(
        `update reviews set wallet_address = $2, reward_status = 'pending' where id = $1`,
        [r.id, wallet],
      );
      return reply.code(502).send({
        status: "failed",
        error: "payout_failed",
        amountUsd: Number(r.reward_amount_usd),
      });
    }

    const txHash = `mock_${createHash("sha256").update(`${r.id}:${Date.now()}`).digest("hex").slice(0, 40)}`;
    await pool.query(
      `
      insert into reward_intents (review_id, player_id, ab_group, amount_usd, wallet_address, status, provider_ref, updated_at)
      values ($1,$2,$3,$4,$5,'paid',$6,now())
      `,
      [
        r.id,
        body.data.playerId,
        r.reward_group || "A",
        Number(r.reward_amount_usd),
        wallet,
        txHash,
      ],
    );
    await pool.query(
      `
      update reviews set
        wallet_address = $2,
        tx_hash = $3,
        reward_status = 'paid'
      where id = $1
      `,
      [r.id, wallet, txHash],
    );

    return {
      status: "paid" as const,
      amountUsd: Number(r.reward_amount_usd),
      txHash,
      alreadyPaid: false,
    };
  });

  app.get("/v1/rewards/pending", async (req, reply) => {
    const q = z
      .object({ playerId: z.string().uuid() })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query" });

    const { rows } = await pool.query(
      `
      select r.id as review_id, r.reward_amount_usd, r.reward_group, r.reward_status,
             r.wallet_address, c.slug as casino_slug, c.name as casino_name
      from reviews r
      join casinos c on c.id = r.casino_id
      where r.player_id = $1
        and r.status = 'approved'
        and r.reward_status in ('pending','failed')
        and r.reward_amount_usd is not null
      order by r.published_at desc nulls last
      limit 10
      `,
      [q.data.playerId],
    );
    return {
      items: rows.map((row) => ({
        reviewId: row.review_id,
        amountUsd: Number(row.reward_amount_usd),
        abGroup: row.reward_group,
        rewardStatus: row.reward_status,
        walletAddress: row.wallet_address,
        casinoSlug: row.casino_slug,
        casinoName: row.casino_name,
      })),
    };
  });
}

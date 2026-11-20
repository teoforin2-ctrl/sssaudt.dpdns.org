import Fastify from "fastify";
import cors from "@fastify/cors";
import { createPool } from "./db.js";
import { createRedis } from "./redis.js";
import {
  getCachedCasinoCard,
  getCachedCasinoList,
  setCachedCasinoCard,
  setCachedCasinoList,
} from "./cache.js";
import { registerAuth } from "./auth.js";
import { registerAccount } from "./account.js";
import { registerAdmin } from "./admin.js";
import { registerAdminPartners } from "./admin-partners.js";
import { registerForum } from "./forum.js";
import { registerSiteSettings } from "./site-settings.js";
import { registerSeo } from "./seo.js";
import { registerOg } from "./og.js";
import { registerSeoPipeline } from "./seo-pipeline.js";
import { registerSeoValidate } from "./seo-validate.js";
import { registerSeoMonitor } from "./seo-monitor.js";
import { registerB2b } from "./b2b.js";
import { registerReviews } from "./reviews.js";
import { registerPartner } from "./partner.js";
import { registerKanban } from "./kanban.js";
import { registerTrust } from "./trust.js";
import { registerGamification } from "./gamification.js";
import { registerAiAdmin } from "./ai/admin.js";
import { registerParserAdmin } from "./ai/parser-admin.js";
import { startAiWorker, stopAiWorker } from "./ai/worker.js";
import {
  decodeStoredText,
  rankSearchHits,
  type HealthResponse,
  type SearchCandidate,
} from "@x-reviewer/shared";
import { pickEntitySeo } from "./entity-seo.js";




const port = Number(process.env.API_PORT ?? 3712);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = Fastify({
  logger: true,
  // Article cover uploads arrive as base64 data URLs from the admin UI.
  bodyLimit: 10 * 1024 * 1024,
});

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

const pool = createPool();
const redis = createRedis();

await registerAuth(app, pool);
await registerAccount(app, pool);
await registerAdmin(app, pool, redis);
await registerAdminPartners(app, pool, redis);
await registerReviews(app, pool, redis);
await registerPartner(app, pool, redis);
await registerForum(app, pool);
await registerSiteSettings(app, pool);
await registerSeo(app, pool);
await registerOg(app, pool);
await registerSeoPipeline(app, pool, redis);
await registerSeoValidate(app, pool);
await registerSeoMonitor(app, pool, redis);
await registerB2b(app, pool);
await registerKanban(app, pool);
await registerTrust(app, pool);
await registerGamification(app, pool);
await registerAiAdmin(app, pool);
await registerParserAdmin(app, pool);
startAiWorker(pool);

app.get("/health", async (): Promise<HealthResponse> => ({
  ok: true,
  service: "x-reviewer-api",
  ts: new Date().toISOString(),
}));

app.get("/ready", async (_req, reply) => {
  const checks: Record<string, "ok" | "fail"> = {
    postgres: "fail",
    redis: "fail",
  };

  try {
    await pool.query("select 1");
    checks.postgres = "ok";
  } catch (err) {
    app.log.error({ err }, "postgres ready check failed");
  }

  try {
    const pong = await redis.ping();
    if (pong === "PONG") checks.redis = "ok";
  } catch (err) {
    app.log.error({ err }, "redis ready check failed");
  }

  const ok = Object.values(checks).every((v) => v === "ok");
  return reply.code(ok ? 200 : 503).send({ ok, checks });
});

/** Listing: final_rating ↓, hot, has_representative, id */
app.get("/v1/casinos", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const limitRaw = Number((req.query as { limit?: string }).limit || 0);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.floor(limitRaw)) : 0;

  const cached = await getCachedCasinoList<{ locale: string; items: unknown[] }>(redis, lang);
  if (cached.data) {
    const items = Array.isArray(cached.data.items) ? cached.data.items : [];
    return {
      ...cached.data,
      items: limit > 0 ? items.slice(0, limit) : items,
      total: items.length,
    };
  }

  const { rows } = await pool.query<{
    id: string;
    slug: string;
    name: string;
    name_ru: string | null;
    name_en: string | null;
    logo_url: string | null;
    license: string | null;
    final_rating: string | null;
    editorial_score: string | null;
    player_score: string | null;
    hot: boolean;
    has_representative: boolean;
    short_desc_ru: string | null;
    short_desc_en: string | null;
    created_at: string | Date | null;
    info_json: Record<string, unknown> | null;
    bonus_title: string | null;
    bonus_wager: string | null;
    bonus_promo: string | null;
    bonus_checked_at: string | null;
    review_count: number;
    reviews_display: number | null;
    rn: string;
  }>(
    `
    with ranked as (
      select
        c.*,
        row_number() over (
          order by
            c.sort_order asc,
            coalesce(c.final_rating, c.editorial_score, 0) desc,
            c.hot desc,
            c.has_representative desc,
            c.id desc
        ) as rn
      from casinos c
      where c.status = 'published'
    )
    select
      r.id, r.slug, r.name, r.name_ru, r.name_en, r.logo_url, r.license,
      r.final_rating, r.editorial_score, r.player_score, r.hot, r.has_representative,
      r.short_desc_ru, r.short_desc_en, r.created_at, r.info_json, r.rn::text,
      nullif(r.info_json->>'reviewsDisplay','')::int as reviews_display,
      (
        select coalesce(b.title_ru, b.title)
        from bonuses b
        where b.casino_id = r.id and b.status = 'active' and b.published = true
        order by b.checked_at desc nulls last, b.created_at desc
        limit 1
      ) as bonus_title,
      (
        select b.wager from bonuses b
        where b.casino_id = r.id and b.status = 'active' and b.published = true
        order by b.checked_at desc nulls last, b.created_at desc limit 1
      ) as bonus_wager,
      (
        select b.promo_code from bonuses b
        where b.casino_id = r.id and b.status = 'active' and b.published = true
        order by b.checked_at desc nulls last, b.created_at desc limit 1
      ) as bonus_promo,
      (
        select b.checked_at from bonuses b
        where b.casino_id = r.id and b.status = 'active' and b.published = true
        order by b.checked_at desc nulls last, b.created_at desc limit 1
      ) as bonus_checked_at,
      (
        select count(*)::int from reviews rv
        where rv.casino_id = r.id and rv.status = 'approved'
      ) as review_count
    from ranked r
    order by r.rn
    `,
  );

  const payload = {
    locale: lang,
    items: rows.map((r) => {
      const rank = Number(r.rn);
      const reviewCount = Number(r.review_count || 0);
      const displayReviews =
        r.reviews_display != null && r.reviews_display > reviewCount
          ? r.reviews_display
          : reviewCount;
      const playerScore = r.player_score != null ? Number(r.player_score) : null;
      const info = r.info_json || {};
      const cardBonus =
        typeof info.bonus === "string" && info.bonus.trim() ? info.bonus.trim() : null;
      const cardPromo =
        typeof info.promocode === "string" && info.promocode.trim()
          ? info.promocode.trim()
          : null;
      return {
        id: r.id,
        slug: r.slug,
        name: (lang === "en" ? r.name_en : r.name_ru) || r.name,
        logoUrl: r.logo_url,
        license: r.license,
        rating: Number(r.final_rating ?? r.editorial_score ?? 0),
        editorialScore: Number(r.editorial_score ?? 0),
        playerScore: displayReviews >= 5 ? playerScore : null,
        reviewCount: displayReviews,
        hot: r.hot,
        top: rank <= 5,
        rank,
        isNew:
          r.created_at != null
            ? Date.now() - new Date(r.created_at).getTime() <= 45 * 86400000
            : false,
        hasRepresentative: r.has_representative,
        // shortDesc omitted from list (card-only) — keeps HTML/JSON payload lean
        bonusLabel: cardBonus || r.bonus_title,
        bonusWager: r.bonus_wager ?? null,
        bonusPromo: cardPromo || r.bonus_promo || null,
        bonusCheckedAt: r.bonus_checked_at ?? null,
        crypto: info.crypto === true,
      };
    }),
  };
  await setCachedCasinoList(redis, cached.key, payload);
  const items = payload.items;
  return {
    ...payload,
    items: limit > 0 ? items.slice(0, limit) : items,
    total: items.length,
  };
});

app.get("/v1/casinos/:slug", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const reviewPage = Math.max(1, Number((req.query as { reviewPage?: string }).reviewPage || 1) || 1);

  if (reviewPage === 1) {
    const cached = await getCachedCasinoCard<{ locale: string; casino: unknown }>(redis, slug, lang);
    if (cached.data) return cached.data;
  }

  const { rows } = await pool.query(
    `
    with ranked as (
      select
        c.*,
        row_number() over (
          order by
            c.sort_order asc,
            coalesce(c.final_rating, c.editorial_score, 0) desc,
            c.hot desc,
            c.has_representative desc,
            c.id desc
        ) as rn
      from casinos c
      where c.status = 'published'
    )
    select * from ranked where slug = $1
    `,
    [slug],
  );

  if (!rows[0]) {
    const { rows: anyRows } = await pool.query(
      `select 1 from casinos where slug = $1 limit 1`,
      [slug],
    );
    if (anyRows[0]) return reply.code(410).send({ error: "gone" });
    return reply.code(404).send({ error: "not_found" });
  }
  const c = rows[0];
  const rank = Number(c.rn);
  const entitySeo = pickEntitySeo(c.seo, lang);

  const bonuses = await pool.query(
    `
    select id, title, title_ru, title_en, promo_code, type, amount_or_percent,
           percent_value, is_percent_deposit, wager, status,
           description_ru, terms_ru, image_url
    from bonuses
    where casino_id = $1 and status = 'active' and published = true
    order by created_at desc
    `,
    [c.id],
  );

  const payments = await pool.query(
    `
    select pm.code, pm.name_ru, pm.name_en
    from casino_payment_methods cpm
    join payment_methods pm on pm.id = cpm.payment_method_id
    where cpm.casino_id = $1
    order by pm.name_en
    `,
    [c.id],
  );

  const providers = await pool.query(
    `
    select p.code, p.name
    from casino_providers cp
    join providers p on p.id = cp.provider_id
    where cp.casino_id = $1
    order by p.name
    `,
    [c.id],
  );

  const info =
    c.info_json && typeof c.info_json === "object" ? (c.info_json as Record<string, unknown>) : {};
  const cardBonus =
    typeof info.bonus === "string" && info.bonus.trim() ? info.bonus.trim() : null;
  const cardPromo =
    typeof info.promocode === "string" && info.promocode.trim()
      ? info.promocode.trim()
      : null;
  const reviewsDisplay =
    typeof info.reviewsDisplay === "number"
      ? info.reviewsDisplay
      : Number(info.reviewsDisplay || 0) || null;

  const bonusPromo =
    bonuses.rows.find((b) => b.is_percent_deposit && b.promo_code) ||
    bonuses.rows.find((b) => b.promo_code);
  const promo =
    cardBonus || cardPromo
      ? {
          promo_code: cardPromo || bonusPromo?.promo_code || null,
          percent_value: bonusPromo?.percent_value ?? null,
          title: cardBonus || bonusPromo?.title_ru || bonusPromo?.title || null,
          title_ru: cardBonus,
          title_en: cardBonus,
        }
      : bonusPromo;

  const reviewPageSize = 20;
  const reviewOffset = (reviewPage - 1) * reviewPageSize;

  const reviewCountRes = await pool.query<{ n: string; avg: string | null }>(
    `
    select count(*)::text as n, avg(rating)::text as avg
    from reviews
    where casino_id = $1 and status = 'approved'
    `,
    [c.id],
  );
  const reviewTotalRaw = Number(reviewCountRes.rows[0]?.n || 0);
  const reviewTotal =
    reviewsDisplay != null && reviewsDisplay > reviewTotalRaw ? reviewsDisplay : reviewTotalRaw;
  const reviewAvg =
    reviewCountRes.rows[0]?.avg != null ? Number(reviewCountRes.rows[0].avg) : null;
  const playerScore =
    c.player_score != null
      ? Number(c.player_score)
      : reviewAvg != null
        ? Number(reviewAvg.toFixed(1))
        : null;

  const reviews = await pool.query(
    `
    select id, rating, body, author_name, author_rank, date_text, published_at
    from reviews
    where casino_id = $1 and status = 'approved'
    order by published_at desc nulls last, created_at desc
    limit $2 offset $3
    `,
    [c.id, reviewPageSize, reviewOffset],
  );

  const reviewPages = Math.max(1, Math.ceil(reviewTotalRaw / reviewPageSize));

  const payload = {
    locale: lang,
    casino: {
      id: c.id,
      slug: c.slug,
      name: (lang === "en" ? c.name_en : c.name_ru) || c.name,
      logoUrl: c.logo_url,
      license: c.license,
      languages: c.languages,
      countriesAllowed: c.countries_allowed,
      countriesBlocked: c.countries_blocked,
      platforms: c.platforms,
      editorialScore: Number(c.editorial_score ?? 0),
      playerScore,
      rating: Number(c.final_rating ?? c.editorial_score ?? 0),
      hot: c.hot,
      top: rank <= 5,
      rank,
      hasRepresentative: c.has_representative,
      shortDesc: lang === "en" ? c.short_desc_en : c.short_desc_ru,
      description: lang === "en" ? c.description_en : c.description_ru,
      seo: {
        title: entitySeo.title || null,
        description: entitySeo.description || null,
        h1: entitySeo.h1 || null,
        ogImage: entitySeo.ogImage || null,
      },
      payments: payments.rows.map((p) => ({
        code: p.code,
        name: lang === "en" ? p.name_en : p.name_ru,
      })),
      providers: providers.rows,
      bonuses: bonuses.rows.map((b) => ({
        id: b.id,
        title: (lang === "en" ? b.title_en : b.title_ru) || b.title,
        promoCode: b.promo_code,
        type: b.type,
        amountOrPercent: b.amount_or_percent,
        wager: b.wager,
        description: decodeStoredText(b.description_ru as string | null),
        terms: b.terms_ru as string | null,
        imageUrl: b.image_url as string | null,
      })),
      promo: promo
        ? {
            code: promo.promo_code,
            percent: promo.percent_value != null ? Number(promo.percent_value) : null,
            title:
              ("title_ru" in promo && promo.title_ru) ||
              (lang === "en" ? promo.title_en : promo.title_ru) ||
              promo.title,
          }
        : null,
      reviewCount: reviewTotal,
      reviews: {
        page: reviewPage,
        pageSize: reviewPageSize,
        total: reviewTotalRaw,
        pages: reviewPages,
        items: reviews.rows.map((r) => ({
          id: r.id,
          rating: Number(r.rating ?? 0),
          body: r.body,
          authorName: r.author_name,
          authorRank: r.author_rank,
          dateText: r.date_text,
          publishedAt: r.published_at,
        })),
      },
    },
  };

  if (reviewPage === 1) {
    const cached = await getCachedCasinoCard(redis, slug, lang);
    await setCachedCasinoCard(redis, cached.key, payload);
  }
  return payload;
});

app.get("/v1/casinos/:slug/reviews", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const pageSize = Math.min(
    50,
    Math.max(1, Number((req.query as { limit?: string }).limit || 20) || 20),
  );
  const page = Math.max(1, Number((req.query as { page?: string }).page || 1) || 1);
  const offset = (page - 1) * pageSize;

  const { rows: casinoRows } = await pool.query(
    `select id from casinos where slug = $1 and status = 'published' limit 1`,
    [slug],
  );
  if (!casinoRows[0]) return reply.code(404).send({ error: "not_found" });
  const casinoId = casinoRows[0].id as string;

  const countRes = await pool.query<{ n: string }>(
    `select count(*)::text as n from reviews where casino_id = $1 and status = 'approved'`,
    [casinoId],
  );
  const total = Number(countRes.rows[0]?.n || 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const { rows } = await pool.query(
    `
    select r.id, r.rating, r.body, r.author_name, r.author_rank, r.date_text, r.published_at,
           rr.body as reply_body, rr.updated_at as reply_updated_at
    from reviews r
    left join review_replies rr on rr.review_id = r.id
    where r.casino_id = $1 and r.status = 'approved'
    order by r.published_at desc nulls last, r.created_at desc
    limit $2 offset $3
    `,
    [casinoId, pageSize, offset],
  );

  return {
    slug,
    page,
    pageSize,
    total,
    pages,
    items: rows.map((r) => ({
      id: r.id,
      rating: Number(r.rating ?? 0),
      body: r.body,
      authorName: r.author_name,
      authorRank: r.author_rank,
      dateText: r.date_text,
      publishedAt: r.published_at,
      reply: r.reply_body
        ? { body: r.reply_body, updatedAt: r.reply_updated_at }
        : null,
    })),
  };
});


app.get("/v1/slots", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const limit = Math.min(Number((req.query as { limit?: string }).limit || 48) || 48, 120);
  const providerSlug = String((req.query as { provider?: string }).provider || "").trim();
  try {
    const params: unknown[] = [limit];
    let where = `s.status = 'published'`;
    if (providerSlug) {
      params.push(providerSlug);
      where += ` and p.slug = $${params.length}`;
    }
    const { rows } = await pool.query(
      `
      select s.id, s.slug, s.title, s.theme, s.mechanics, s.release_date, s.rtp, s.volatility, s.grid,
             s.demo_url, s.description_ru, s.description_en,
             p.name as provider_name, p.slug as provider_slug
      from slots s
      left join game_providers p on p.id = s.provider_id
      where ${where}
      order by s.release_date desc nulls last, s.title asc
      limit $1
      `,
      params,
    );
    return {
      locale: lang,
      items: rows.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        theme: s.theme,
        mechanics: s.mechanics || [],
        releaseDate: s.release_date,
        rtp: s.rtp != null ? Number(s.rtp) : null,
        volatility: s.volatility,
        grid: s.grid,
        demoUrl: s.demo_url,
        description: lang === "en" ? s.description_en : s.description_ru,
        providerName: s.provider_name,
        providerSlug: s.provider_slug,
        isNew: s.release_date
          ? (Date.now() - new Date(s.release_date as string).getTime()) / 86400000 <= 45
          : false,
        hasBonus: Array.isArray(s.mechanics) && s.mechanics.includes("bonus-buy"),
      })),
    };
  } catch (err) {
    app.log.error({ err }, "slots list failed");
    return { locale: lang, items: [] };
  }
});

app.get("/v1/slots/:slug", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  try {
    const { rows } = await pool.query(
      `
      select s.id, s.slug, s.title, s.theme, s.mechanics, s.release_date, s.rtp, s.volatility, s.grid,
             s.demo_url, s.description_ru, s.description_en, s.seo,
             p.name as provider_name, p.slug as provider_slug
      from slots s
      left join game_providers p on p.id = s.provider_id
      where s.status = 'published' and s.slug = $1
      limit 1
      `,
      [slug],
    );
    const s = rows[0];
    if (!s) {
      const { rows: anyRows } = await pool.query(
        `select 1 from slots where slug = $1 limit 1`,
        [slug],
      );
      if (anyRows[0]) return reply.code(410).send({ error: "gone" });
      return reply.code(404).send({ error: "not_found" });
    }
    const entitySeo = pickEntitySeo(s.seo, lang);

    let casinos: { slug: string; name: string }[] = [];
    try {
      const { rows: cr } = await pool.query(
        `
        select c.slug, coalesce(nullif(c.name_${lang}, ''), c.name) as name
        from slot_casinos sc
        join casinos c on c.id = sc.casino_id
        where sc.slot_id = $1 and c.status = 'published'
        order by c.sort_order asc, coalesce(c.final_rating, c.editorial_score, 0) desc
        limit 12
        `,
        [s.id],
      );
      casinos = cr;
    } catch {
      casinos = [];
    }

    return {
      locale: lang,
      slot: {
        id: s.id,
        slug: s.slug,
        title: s.title,
        theme: s.theme,
        mechanics: s.mechanics || [],
        releaseDate: s.release_date,
        rtp: s.rtp != null ? Number(s.rtp) : null,
        volatility: s.volatility,
        grid: s.grid,
        demoUrl: s.demo_url,
        description: lang === "en" ? s.description_en : s.description_ru,
        providerName: s.provider_name,
        providerSlug: s.provider_slug,
        seo: {
          title: entitySeo.title || null,
          description: entitySeo.description || null,
          h1: entitySeo.h1 || null,
          ogImage: entitySeo.ogImage || null,
        },
        isNew: s.release_date
          ? (Date.now() - new Date(s.release_date as string).getTime()) / 86400000 <= 45
          : false,
        casinos,
      },
    };
  } catch (err) {
    app.log.error({ err, slug }, "slot detail failed");
    return reply.code(500).send({ error: "slot_failed" });
  }
});

/** Game studios (slot providers) */
app.get("/v1/game-providers", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  try {
    const { rows } = await pool.query(
      `
      select gp.id, gp.slug, gp.name,
             coalesce(nullif(gp.description_${lang}, ''), gp.description_ru, gp.description_en, '') as description,
             (select count(*)::int from slots s where s.provider_id = gp.id and s.status = 'published') as slots_count
      from game_providers gp
      where gp.status = 'published'
      order by slots_count desc, gp.name asc
      `,
    );
    return {
      locale: lang,
      items: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        description: r.description || null,
        slotsCount: Number(r.slots_count || 0),
      })),
    };
  } catch (err) {
    app.log.error({ err }, "game-providers list failed");
    return { locale: lang, items: [] };
  }
});

app.get("/v1/game-providers/:slug", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  try {
    const { rows } = await pool.query(
      `
      select gp.id, gp.slug, gp.name,
             coalesce(nullif(gp.description_${lang}, ''), gp.description_ru, gp.description_en, '') as description
      from game_providers gp
      where gp.status = 'published' and gp.slug = $1
      limit 1
      `,
      [slug],
    );
    const gp = rows[0];
    if (!gp) return reply.code(404).send({ error: "not_found" });

    const { rows: slots } = await pool.query(
      `
      select s.slug, s.title, s.theme, s.rtp, s.demo_url, s.release_date
      from slots s
      where s.provider_id = $1 and s.status = 'published'
      order by s.release_date desc nulls last, s.title asc
      limit 48
      `,
      [gp.id],
    );

    const { rows: casinos } = await pool.query(
      `
      select distinct c.slug,
             coalesce(nullif(c.name_${lang}, ''), c.name) as name,
             c.logo_url,
             coalesce(c.final_rating, c.editorial_score, 0) as rating,
             c.hot
      from slot_casinos sc
      join slots s on s.id = sc.slot_id
      join casinos c on c.id = sc.casino_id
      where s.provider_id = $1 and c.status = 'published' and s.status = 'published'
      order by c.hot desc, rating desc
      limit 24
      `,
      [gp.id],
    );

    return {
      locale: lang,
      provider: {
        slug: gp.slug,
        name: gp.name,
        description: gp.description || null,
        slotsCount: slots.length,
        slots: slots.map((s) => ({
          slug: s.slug,
          title: s.title,
          theme: s.theme,
          rtp: s.rtp != null ? Number(s.rtp) : null,
          demoUrl: s.demo_url,
          isNew: s.release_date
            ? (Date.now() - new Date(s.release_date as string).getTime()) / 86400000 <= 45
            : false,
        })),
        casinos: casinos.map((c) => ({
          slug: c.slug,
          name: c.name,
          logoUrl: c.logo_url,
          rating: Number(c.rating || 0),
          hot: Boolean(c.hot),
        })),
      },
    };
  } catch (err) {
    app.log.error({ err, slug }, "game-provider detail failed");
    return reply.code(500).send({ error: "provider_failed" });
  }
});

/** Payment methods catalogue */
app.get("/v1/payments", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  try {
    const { rows } = await pool.query(
      `
      select pm.code, pm.name_ru, pm.name_en,
             (select count(*)::int
              from casino_payment_methods cpm
              join casinos c on c.id = cpm.casino_id
              where cpm.payment_method_id = pm.id and c.status = 'published') as casinos_count
      from payment_methods pm
      order by casinos_count desc, pm.code asc
      `,
    );
    return {
      locale: lang,
      items: rows.map((r) => ({
        code: r.code,
        name: lang === "en" ? r.name_en : r.name_ru,
        casinosCount: Number(r.casinos_count || 0),
        crypto: ["btc", "eth", "usdt"].includes(String(r.code)),
      })),
    };
  } catch (err) {
    app.log.error({ err }, "payments list failed");
    return { locale: lang, items: [] };
  }
});

app.get("/v1/payments/:code", async (req, reply) => {
  const { code } = req.params as { code: string };
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  try {
    const { rows: pmRows } = await pool.query(
      `select id, code, name_ru, name_en from payment_methods where code = $1 limit 1`,
      [code.toLowerCase()],
    );
    const pm = pmRows[0];
    if (!pm) return reply.code(404).send({ error: "not_found" });

    const { rows } = await pool.query(
      `
      select c.id, c.slug,
             coalesce(nullif(c.name_${lang}, ''), c.name) as name,
             c.logo_url, c.hot, c.has_representative,
             coalesce(c.final_rating, c.editorial_score, 0) as rating,
             c.editorial_score, c.player_score,
             (select count(*)::int from reviews rv where rv.casino_id = c.id and rv.status = 'approved') as review_count
      from casino_payment_methods cpm
      join casinos c on c.id = cpm.casino_id
      where cpm.payment_method_id = $1 and c.status = 'published'
      order by c.hot desc, rating desc
      limit 60
      `,
      [pm.id],
    );

    return {
      locale: lang,
      payment: {
        code: pm.code,
        name: lang === "en" ? pm.name_en : pm.name_ru,
        crypto: ["btc", "eth", "usdt"].includes(String(pm.code)),
      },
      items: rows.map((r, i) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        logoUrl: r.logo_url,
        rating: Number(r.rating || 0),
        editorialScore: r.editorial_score != null ? Number(r.editorial_score) : undefined,
        playerScore: r.player_score != null ? Number(r.player_score) : null,
        reviewCount: Number(r.review_count || 0),
        hot: Boolean(r.hot),
        top: i < 5,
        rank: i + 1,
        hasRepresentative: Boolean(r.has_representative),
      })),
    };
  } catch (err) {
    app.log.error({ err, code }, "payment detail failed");
    return reply.code(500).send({ error: "payment_failed" });
  }
});

/** Compare up to 3 casinos */
app.get("/v1/compare", async (req, reply) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const raw = String((req.query as { slugs?: string }).slugs || "");
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 4);
  if (slugs.length < 2) {
    return reply.code(400).send({ error: "need_2_slugs" });
  }

  const { rows } = await pool.query(
    `
    select c.id, c.slug,
           coalesce(nullif(c.name_${lang}, ''), c.name) as name,
           c.logo_url, c.license, c.hot, c.has_representative, c.platforms,
           coalesce(nullif(c.short_desc_${lang}, ''), '') as short_desc,
           c.editorial_score, c.player_score,
           coalesce(c.final_rating, c.editorial_score, 0) as rating,
           (select count(*)::int from reviews rv where rv.casino_id = c.id and rv.status = 'approved') as review_count,
           (
             select coalesce(b.title_${lang}, b.title)
             from bonuses b
             where b.casino_id = c.id and b.status = 'active' and b.published = true
             order by b.checked_at desc nulls last limit 1
           ) as bonus_title
    from casinos c
    where c.status = 'published' and c.slug = any($1::text[])
    `,
    [slugs],
  );

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const ordered = slugs.map((s) => bySlug.get(s)).filter(Boolean);
  if (ordered.length < 2) return reply.code(404).send({ error: "not_found" });

  const items = [];
  for (const r of ordered) {
    const { rows: payments } = await pool.query(
      `
      select pm.code, pm.name_ru, pm.name_en
      from casino_payment_methods cpm
      join payment_methods pm on pm.id = cpm.payment_method_id
      where cpm.casino_id = $1
      order by pm.code
      `,
      [r!.id],
    );
    const { rows: providers } = await pool.query(
      `
      select p.code, p.name
      from casino_providers cp
      join providers p on p.id = cp.provider_id
      where cp.casino_id = $1
      order by p.name
      `,
      [r!.id],
    );
    items.push({
      slug: r!.slug,
      name: r!.name,
      logoUrl: r!.logo_url,
      license: r!.license,
      hot: Boolean(r!.hot),
      hasRepresentative: Boolean(r!.has_representative),
      platforms: r!.platforms || [],
      shortDesc: r!.short_desc || null,
      editorialScore: r!.editorial_score != null ? Number(r!.editorial_score) : 0,
      playerScore: r!.player_score != null ? Number(r!.player_score) : null,
      rating: Number(r!.rating || 0),
      reviewCount: Number(r!.review_count || 0),
      bonusLabel: r!.bonus_title || null,
      payments: payments.map((p) => ({
        code: p.code,
        name: lang === "en" ? p.name_en : p.name_ru,
      })),
      providers: providers.map((p) => ({ code: p.code, name: p.name })),
    });
  }

  return { locale: lang, items };
});

app.get("/v1/authors", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const { rows } = await pool.query(
    `
    select au.slug, au.name, au.role_ru, au.role_en, au.bio_ru, au.bio_en, au.hue,
           count(a.id)::int as articles_count
    from authors au
    left join articles a on a.author_id = au.id and a.status = 'published'
    group by au.id
    order by articles_count desc, au.name asc
    `,
  );
  return {
    locale: lang,
    items: rows.map((a) => ({
      slug: a.slug,
      name: a.name,
      role: lang === "en" ? a.role_en || a.role_ru : a.role_ru || a.role_en,
      bio: lang === "en" ? a.bio_en || a.bio_ru : a.bio_ru || a.bio_en,
      hue: a.hue,
      articlesCount: a.articles_count,
    })),
  };
});

app.get("/v1/authors/:slug", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const { rows } = await pool.query(
    `
    select slug, name, role_ru, role_en, bio_ru, bio_en, hue, quote_ru, quote_en
    from authors where slug = $1 limit 1
    `,
    [slug],
  );
  const a = rows[0];
  if (!a) return reply.code(404).send({ error: "not_found" });

  const { rows: arts } = await pool.query(
    `
    select slug, kind, title_ru, title_en, excerpt_ru, excerpt_en, cover_theme, cover_url,
           reading_minutes, published_at
    from articles
    where author_id = (select id from authors where slug = $1)
      and status = 'published'
    order by published_at desc nulls last
    limit 40
    `,
    [slug],
  );

  return {
    locale: lang,
    author: {
      slug: a.slug,
      name: a.name,
      role: lang === "en" ? a.role_en || a.role_ru : a.role_ru || a.role_en,
      bio: lang === "en" ? a.bio_en || a.bio_ru : a.bio_ru || a.bio_en,
      quote: lang === "en" ? a.quote_en || a.quote_ru : a.quote_ru || a.quote_en,
      hue: a.hue,
    },
    articles: arts.map((x) => ({
      slug: x.slug,
      kind: x.kind,
      title: lang === "en" ? x.title_en : x.title_ru,
      excerpt: lang === "en" ? x.excerpt_en : x.excerpt_ru,
      coverTheme: x.cover_theme,
      coverUrl: x.cover_url,
      readingMinutes: x.reading_minutes,
      publishedAt: x.published_at,
    })),
  };
});

app.get("/v1/bonuses", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const limit = Math.min(Number((req.query as { limit?: string }).limit || 48) || 48, 120);
  const includeExpired = String((req.query as { includeExpired?: string }).includeExpired || "") === "1";
  try {
    const { rows } = await pool.query(
      `
      select b.id, b.title, b.title_ru, b.title_en, b.type, b.amount_or_percent, b.wager,
             b.promo_code, b.min_deposit, b.valid_until, b.checked_at, b.description_ru, b.description_en,
             c.slug as casino_slug, c.name as casino_name, c.name_ru, c.name_en, c.logo_url
      from bonuses b
      join casinos c on c.id = b.casino_id
      where b.status = 'active' and b.published = true and c.status = 'published'
        and (
          $2::boolean
          or b.valid_until is null
          or b.valid_until > now()
        )
      order by b.checked_at desc nulls last, b.created_at desc
      limit $1
      `,
      [limit, includeExpired],
    );

    return {
      locale: lang,
      items: rows.map((b) => ({
        id: b.id,
        title: (lang === "en" ? b.title_en : b.title_ru) || b.title,
        type: b.type,
        amountOrPercent: b.amount_or_percent,
        wager: b.wager,
        promoCode: b.promo_code,
        minDeposit: b.min_deposit,
        validUntil: b.valid_until,
        checkedAt: b.checked_at,
        description: decodeStoredText(
          lang === "en" ? b.description_en : b.description_ru,
        ),
        casinoSlug: b.casino_slug,
        casinoName: (lang === "en" ? b.name_en : b.name_ru) || b.casino_name,
        casinoLogoUrl: b.logo_url,
      })),
    };
  } catch (err) {
    app.log.error({ err }, "bonuses list failed");
    return { locale: lang, items: [] };
  }
});

app.get("/v1/promo-ticker", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const limit = Math.min(Number((req.query as { limit?: string }).limit || 24) || 24, 48);
  try {
    const { rows } = await pool.query(
      `
      select c.slug,
             coalesce(nullif(c.name_ru, ''), c.name) as name_ru,
             coalesce(nullif(c.name_en, ''), c.name) as name_en,
             nullif(trim(c.info_json->>'promocode'), '') as code,
             nullif(trim(c.info_json->>'bonus'), '') as offer
      from casinos c
      where c.status = 'published'
        and coalesce(trim(c.info_json->>'promocode'), '') <> ''
      order by c.sort_order asc, c.final_rating desc nulls last, c.name asc
      limit $1
      `,
      [limit],
    );
    return {
      items: rows.map((r) => ({
        casino: lang === "en" ? r.name_en : r.name_ru,
        code: r.code as string,
        offer: (r.offer as string | null) || null,
        slug: r.slug as string,
      })),
    };
  } catch (err) {
    app.log.error({ err }, "promo-ticker failed");
    return { items: [] };
  }
});

app.get("/v1/articles", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const limit = Math.min(Number((req.query as { limit?: string }).limit || 48) || 48, 120);
  const kind = String((req.query as { kind?: string }).kind || "").trim();
  try {
    const params: unknown[] = [limit];
    let kindClause = "";
    if (kind) {
      params.push(kind);
      kindClause = `and a.kind = $2`;
    }
    const { rows } = await pool.query(
      `
      select a.slug, a.kind, a.topic, a.title_ru, a.title_en, a.excerpt_ru, a.excerpt_en,
             a.cover_theme, a.cover_url, a.reading_minutes, a.published_at,
             au.name as author_name, au.slug as author_slug
      from articles a
      left join authors au on au.id = a.author_id
      where a.status = 'published' ${kindClause}
      order by a.published_at desc
      limit $1
      `,
      params,
    );
    return {
      locale: lang,
      items: rows.map((a) => ({
        slug: a.slug,
        kind: a.kind,
        topic: a.topic,
        title: lang === "en" ? a.title_en : a.title_ru,
        excerpt: lang === "en" ? a.excerpt_en : a.excerpt_ru,
        coverTheme: a.cover_theme,
        coverUrl: a.cover_url,
        readingMinutes: a.reading_minutes,
        publishedAt: a.published_at,
        authorName: a.author_name,
        authorSlug: a.author_slug,
      })),
    };
  } catch (err) {
    app.log.error({ err }, "articles list failed");
    return { locale: lang, items: [] };
  }
});

app.get("/v1/articles/:slug", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  try {
    const { rows } = await pool.query(
      `
      select a.slug, a.kind, a.topic, a.title_ru, a.title_en, a.excerpt_ru, a.excerpt_en,
             a.body_md_ru, a.body_md_en, a.cover_theme, a.cover_url, a.reading_minutes, a.published_at,
             a.seo, au.name as author_name, au.slug as author_slug
      from articles a
      left join authors au on au.id = a.author_id
      where a.status = 'published' and a.slug = $1
      limit 1
      `,
      [slug],
    );
    const a = rows[0];
    if (!a) {
      const { rows: anyRows } = await pool.query(
        `select 1 from articles where slug = $1 limit 1`,
        [slug],
      );
      if (anyRows[0]) return reply.code(410).send({ error: "gone" });
      return reply.code(404).send({ error: "not_found" });
    }
    const entitySeo = pickEntitySeo(a.seo, lang);
    return {
      locale: lang,
      article: {
        slug: a.slug,
        kind: a.kind,
        topic: a.topic,
        title: lang === "en" ? a.title_en : a.title_ru,
        excerpt: lang === "en" ? a.excerpt_en : a.excerpt_ru,
        bodyMd: lang === "en" ? a.body_md_en : a.body_md_ru,
        coverTheme: a.cover_theme,
        coverUrl: a.cover_url,
        readingMinutes: a.reading_minutes,
        publishedAt: a.published_at,
        authorName: a.author_name,
        authorSlug: a.author_slug,
        seo: {
          title: entitySeo.title || null,
          description: entitySeo.description || null,
          h1: entitySeo.h1 || null,
          ogImage: entitySeo.ogImage || null,
        },
      },
    };
  } catch (err) {
    app.log.error({ err, slug }, "article detail failed");
    return reply.code(500).send({ error: "article_failed" });
  }
});

app.get("/v1/roles", async () => {
  const { rows } = await pool.query(
    `select id, code, name_ru, name_en, description, is_staff from roles order by id`,
  );
  return { items: rows };
});

app.get("/v1/stats", async () => {
  const q = async (sql: string) => {
    try {
      const { rows } = await pool.query<{ n: string }>(sql);
      return Number(rows[0]?.n || 0);
    } catch {
      return 0;
    }
  };
  const reviewsDisplayedSql = `
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
  `;
  const [casinos, slots, providers, bonuses, reviews, articles] = await Promise.all([
    q(`select count(*)::text as n from casinos where status = 'published'`),
    q(`select count(*)::text as n from slots where status = 'published'`),
    q(`select count(*)::text as n from game_providers where status = 'published'`),
    q(`select count(*)::text as n from bonuses where status = 'active' and published = true`),
    q(reviewsDisplayedSql),
    q(`select count(*)::text as n from articles where status = 'published'`),
  ]);
  return { casinos, slots, providers, bonuses, reviews, articles };
});

app.get("/v1/home", async (req) => {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";

  const empty = {
    slots: [] as unknown[],
    newSlots: [] as unknown[],
    articles: [] as unknown[],
    newbieTopics: [] as unknown[],
    brands: {} as Record<string, unknown[]>,
    expert: null as unknown,
    promo: null as unknown,
    recentReviews: [] as unknown[],
    newCasinos: [] as unknown[],
    stats: { casinos: 0, slots: 0, providers: 0, bonuses: 0, reviews: 0, articles: 0 },
  };

  try {
    const count = async (sql: string) => {
      try {
        const { rows } = await pool.query<{ n: string }>(sql);
        return Number(rows[0]?.n || 0);
      } catch {
        return 0;
      }
    };
    // Reviews on the homepage must match casino cards: max(approved, reviewsDisplay).
    const reviewsDisplayedSql = `
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
    `;
    const [casinosN, slotsN, providersN, bonusesN, reviewsN, articlesN] = await Promise.all([
      count(`select count(*)::text as n from casinos where status = 'published'`),
      count(`select count(*)::text as n from slots where status = 'published'`),
      count(`select count(*)::text as n from game_providers where status = 'published'`),
      count(`select count(*)::text as n from bonuses where status = 'active' and published = true`),
      count(reviewsDisplayedSql),
      count(`select count(*)::text as n from articles where status = 'published'`),
    ]);
    const stats = {
      casinos: casinosN,
      slots: slotsN,
      providers: providersN,
      bonuses: bonusesN,
      reviews: reviewsN,
      articles: articlesN,
    };

    // Isolate each query — one missing column/table must not blank the whole homepage.
    const emptyRows = <T = Record<string, unknown>>() =>
      ({ rows: [] as T[] }) as { rows: T[] };
    const [
      slotRes,
      articleRes,
      brandRes,
      expertRes,
      promoRes,
      reviewRes,
      newCasinoRes,
      checksWeekRes,
    ] = await Promise.all([
      pool
        .query(
          `
        select s.id, s.slug, s.title, s.theme, s.mechanics, s.release_date, s.rtp, s.volatility, s.grid,
               s.demo_url, p.name as provider_name, p.slug as provider_slug
        from slots s
        left join game_providers p on p.id = s.provider_id
        where s.status = 'published'
        order by s.release_date desc nulls last
        limit 24
        `,
        )
        .catch((err) => {
          app.log.error({ err }, "home slots query failed");
          return emptyRows();
        }),
      pool
        .query(
          `
        select a.slug, a.kind, a.topic, a.title_ru, a.title_en, a.excerpt_ru, a.excerpt_en,
               a.cover_theme, a.cover_url, a.reading_minutes, a.published_at,
               au.name as author_name, au.slug as author_slug
        from articles a
        left join authors au on au.id = a.author_id
        where a.status = 'published'
        order by a.published_at desc
        limit 24
        `,
        )
        .catch((err) => {
          app.log.error({ err }, "home articles query failed");
          return emptyRows();
        }),
      pool
        .query(
          `
        select kind, slug, name, tagline_ru, tagline_en, bonus_text_ru, bonus_text_en,
               rating, details, partner_url, has_representative, has_hot
        from partner_brands
        where status = 'published'
        order by rating desc
        `,
        )
        .catch((err) => {
          app.log.error({ err }, "home brands query failed");
          return emptyRows();
        }),
      // Prefer locale/photo columns (029+); fall back if migration not applied yet.
      pool
        .query(
          `select slug, name, name_ru, role_ru, role_en, quote_ru, quote_en, hue, is_seed, photo_url
         from authors where is_seed = true order by id limit 1`,
        )
        .catch(() =>
          pool.query(
            `select slug, name, null::text as name_ru, role_ru, role_en, quote_ru, quote_en, hue, is_seed, null::text as photo_url
             from authors where is_seed = true order by id limit 1`,
          ),
        )
        .catch((err) => {
          app.log.error({ err }, "home expert query failed");
          return emptyRows();
        }),
      pool
        .query(
          `
        select pb.id, pb.title_ru, pb.title_en, pb.valid_until, pb.theme,
               c.slug as casino_slug, c.name, c.logo_url
        from promo_banners pb
        left join casinos c on c.id = pb.casino_id
        where pb.active = true
        order by pb.valid_until asc nulls last
        limit 1
        `,
        )
        .catch((err) => {
          app.log.error({ err }, "home promo query failed");
          return emptyRows();
        }),
      pool
        .query(
          `
          select rv.id, rv.rating, rv.body, rv.author_name, rv.published_at,
                 c.slug as casino_slug, c.name as casino_name, c.name_ru, c.name_en
          from reviews rv
          join casinos c on c.id = rv.casino_id
          where rv.status = 'approved' and c.status = 'published'
          order by coalesce(rv.published_at, rv.created_at) desc nulls last
          limit 3
          `,
        )
        .catch(() => emptyRows()),
      pool
        .query(
          `
          select slug, name, name_ru, name_en, logo_url, final_rating, editorial_score, created_at
          from casinos
          where status = 'published'
          order by created_at desc nulls last
          limit 3
          `,
        )
        .catch(() => emptyRows()),
      pool
        .query<{ n: string }>(
          `
          select count(distinct casino_id)::text as n
          from bonuses
          where status = 'active'
            and published = true
            and casino_id is not null
            and checked_at >= now() - interval '14 days'
          `,
        )
        .catch(() => ({ rows: [{ n: "0" }] as { n: string }[] })),
    ]);

    const slotRows = slotRes.rows;
    const mapSlot = (s: (typeof slotRows)[number]) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      theme: s.theme,
      mechanics: s.mechanics || [],
      releaseDate: s.release_date,
      rtp: s.rtp != null ? Number(s.rtp) : null,
      volatility: s.volatility,
      grid: s.grid,
      demoUrl: s.demo_url,
      providerName: s.provider_name,
      providerSlug: s.provider_slug,
      isNew: s.release_date
        ? (Date.now() - new Date(s.release_date as string).getTime()) / 86400000 <= 45
        : false,
      hasBonus: Array.isArray(s.mechanics) && s.mechanics.includes("bonus-buy"),
    });

    const slots = slotRows.map(mapSlot);
    const newSlots = slots.filter((s) => s.isNew).slice(0, 5);

    const articleRows = articleRes.rows;
    const mapArticle = (a: (typeof articleRows)[number]) => ({
      slug: a.slug,
      kind: a.kind,
      topic: a.topic,
      title: lang === "en" ? a.title_en : a.title_ru,
      excerpt: lang === "en" ? a.excerpt_en : a.excerpt_ru,
      coverTheme: a.cover_theme,
      coverUrl: a.cover_url,
      readingMinutes: a.reading_minutes,
      publishedAt: a.published_at,
      authorName: a.author_name,
      authorSlug: a.author_slug,
    });

    const articles = articleRows.map(mapArticle);
    const topics = [
      "basics",
      "terms",
      "getting-started",
      "slots",
      "table-games",
      "live",
      "strategies",
      "bonuses",
      "useful",
    ];
    const newbieTopics = topics.map((topic) => ({
      topic,
      items: articles.filter((a) => a.kind === "guide" && a.topic === topic).slice(0, 6),
    }));

    const mapBrand = (b: (typeof brandRes.rows)[number]) => ({
      kind: b.kind,
      slug: b.slug,
      name: b.name,
      tagline: lang === "en" ? b.tagline_en : b.tagline_ru,
      bonusText: lang === "en" ? b.bonus_text_en : b.bonus_text_ru,
      rating: Number(b.rating),
      details: b.details || {},
      partnerUrl: b.partner_url,
      hasRepresentative: b.has_representative,
      hot: b.has_hot,
    });

    const brands: Record<string, ReturnType<typeof mapBrand>[]> = {
      "poker-room": [],
      bookmaker: [],
      "land-casino": [],
      "affiliate-program": [],
    };
    for (const b of brandRes.rows.map(mapBrand)) {
      if (!brands[b.kind]) brands[b.kind] = [];
      if (brands[b.kind].length < 3) brands[b.kind].push(b);
    }

    const checksThisWeek = Number(checksWeekRes.rows[0]?.n ?? 0);
    const ex = expertRes.rows[0] as
      | {
          slug: string;
          name: string;
          name_ru?: string | null;
          role_ru?: string | null;
          role_en?: string | null;
          quote_ru?: string | null;
          quote_en?: string | null;
          hue?: number | null;
          is_seed?: boolean;
          photo_url?: string | null;
        }
      | undefined;
    const expert = ex
      ? {
          slug: ex.slug,
          name: lang === "en" ? ex.name : (ex.name_ru || ex.name),
          role: lang === "en" ? ex.role_en : ex.role_ru,
          quote: lang === "en" ? ex.quote_en : ex.quote_ru,
          hue: ex.hue,
          isSeed: ex.is_seed,
          photoUrl:
            ex.photo_url ||
            (ex.slug === "mira-volkova" ? "/img/authors/mira-volkova.jpg" : null),
          checksThisWeek,
        }
      : null;

    const pr = promoRes.rows[0];
    const promo = pr
      ? {
          id: pr.id,
          title: lang === "en" ? pr.title_en : pr.title_ru,
          validUntil: pr.valid_until,
          theme: pr.theme,
          casinoSlug: pr.casino_slug,
          casinoName: pr.name,
          logoUrl: pr.logo_url || null,
        }
      : null;

    const recentReviews = reviewRes.rows.map((r) => ({
      id: r.id,
      rating: Number(r.rating ?? 0),
      body: String(r.body || "").slice(0, 180),
      authorName: r.author_name,
      publishedAt: r.published_at,
      casinoSlug: r.casino_slug,
      casinoName: (lang === "en" ? r.name_en : r.name_ru) || r.casino_name,
    }));

    const newCasinos = newCasinoRes.rows.map((c) => ({
      slug: c.slug,
      name: (lang === "en" ? c.name_en : c.name_ru) || c.name,
      logoUrl: c.logo_url,
      rating: Number(c.final_rating ?? c.editorial_score ?? 0),
      isNew: true,
    }));

    return {
      ...empty,
      slots,
      newSlots,
      articles: articles.slice(0, 4),
      newbieTopics,
      brands,
      expert,
      promo,
      recentReviews,
      newCasinos,
      stats,
    };
  } catch (err) {
    app.log.error({ err }, "home aggregate failed");
    return empty;
  }
});

/** Active banners for a placement; image/href resolved by locale (ru|en). */
app.get("/v1/banners", async (req) => {
  const q = req.query as { locale?: string; placement?: string };
  const locale = (q.locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  const placement = q.placement || "home_hero";

  const { rows } = await pool.query<{
    id: string;
    slug: string;
    placement: string;
    title_ru: string | null;
    title_en: string | null;
    image_ru: string;
    image_en: string;
    href_ru: string | null;
    href_en: string | null;
    sort_order: number;
  }>(
    `
    select id, slug, placement, title_ru, title_en, image_ru, image_en, href_ru, href_en, sort_order
    from banners
    where active = true and placement = $1
    order by sort_order asc, created_at asc
    `,
    [placement],
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      placement: r.placement,
      title: lang === "en" ? r.title_en || r.title_ru : r.title_ru || r.title_en,
      imageUrl: lang === "en" ? r.image_en : r.image_ru,
      href: lang === "en" ? r.href_en || r.href_ru : r.href_ru || r.href_en,
      sortOrder: r.sort_order,
    })),
  };
});

app.get("/go/:slug", async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const q = req.query as { subid?: string; locale?: string };

  const { rows } = await pool.query<{
    id: string;
    partner_url: string | null;
  }>(`select id, partner_url from casinos where slug = $1 and status = 'published'`, [slug]);

  const casino = rows[0];
  const target =
    casino?.partner_url ||
    `https://example.com/?casino=${encodeURIComponent(slug)}`;

  try {
    await pool.query(
      `
      insert into go_clicks (casino_slug, casino_id, referrer, ip, user_agent, subid, locale)
      values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        slug,
        casino?.id ?? null,
        (req.headers.referer as string) || null,
        req.ip,
        req.headers["user-agent"] || null,
        q.subid || null,
        q.locale || null,
      ],
    );
  } catch (err) {
    app.log.error({ err, slug }, "go_clicks insert failed");
  }

  app.log.info({ slug, target }, "affiliate redirect");
  return reply.code(302).redirect(target);
});

const shutdown = async () => {
  stopAiWorker();
  await app.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
};

app.get("/v1/search", async (req) => {
  const qRaw = String((req.query as { q?: string }).q || "").trim();
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  const lang = locale.startsWith("en") ? "en" : "ru";
  if (qRaw.length < 1) {
    return { q: qRaw, groups: { casinos: [], slots: [], bonuses: [], articles: [] }, items: [] };
  }

  const like = `%${qRaw.replace(/[%_]/g, "")}%`;
  const candidates: SearchCandidate[] = [];

  try {
    const { rows: casinos } = await pool.query(
      `
      select slug,
             coalesce(nullif(name_${lang}, ''), name) as title,
             coalesce(nullif(short_desc_${lang}, ''), '') as description
      from casinos
      where status = 'published'
        and (
          name ilike $1
          or coalesce(name_ru, '') ilike $1
          or coalesce(name_en, '') ilike $1
          or slug ilike $1
        )
      limit 12
      `,
      [like],
    );
    for (const r of casinos) {
      candidates.push({
        type: "casino",
        slug: r.slug,
        title: r.title,
        description: r.description,
        href: `/casino/${r.slug}`,
      });
    }
  } catch {
    /* table may miss locale cols in older schemas */
  }

  try {
    const { rows: slots } = await pool.query(
      `
      select slug, title,
             coalesce(nullif(description_${lang}, ''), '') as description
      from slots
      where status = 'published'
        and (title ilike $1 or slug ilike $1 or coalesce(description_ru, '') ilike $1 or coalesce(description_en, '') ilike $1)
      limit 12
      `,
      [like],
    );
    for (const r of slots) {
      candidates.push({
        type: "slot",
        slug: r.slug,
        title: r.title,
        description: r.description,
        href: `/slots/${r.slug}`,
      });
    }
  } catch {
    /* slots optional until Phase 1 complete */
  }

  try {
    const { rows: bonuses } = await pool.query(
      `
      select b.id::text as slug,
             coalesce(nullif(b.title_${lang}, ''), b.title) as title,
             coalesce(nullif(b.description_${lang}, ''), coalesce(b.description, '')) as description,
             c.slug as casino_slug
      from bonuses b
      join casinos c on c.id = b.casino_id
      where b.status = 'active' and b.published = true
        and (
          b.title ilike $1
          or coalesce(b.title_ru, '') ilike $1
          or coalesce(b.title_en, '') ilike $1
          or coalesce(b.promo_code, '') ilike $1
        )
      limit 12
      `,
      [like],
    );
    for (const r of bonuses) {
      candidates.push({
        type: "bonus",
        slug: r.slug,
        title: r.title,
        description: r.description,
        href: `/casino/${r.casino_slug}`,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { rows: articles } = await pool.query(
      `
      select slug,
             title_${lang} as title,
             coalesce(excerpt_${lang}, '') as description
      from articles
      where status = 'published'
        and (
          title_ru ilike $1 or title_en ilike $1
          or coalesce(excerpt_ru, '') ilike $1 or coalesce(excerpt_en, '') ilike $1
          or slug ilike $1
        )
      limit 12
      `,
      [like],
    );
    for (const r of articles) {
      candidates.push({
        type: "article",
        slug: r.slug,
        title: r.title,
        description: r.description,
        href: `/articles/${r.slug}`,
      });
    }
  } catch {
    /* ignore */
  }

  const items = rankSearchHits(qRaw, candidates, 4);
  return {
    q: qRaw,
    items,
    groups: {
      casinos: items.filter((i) => i.type === "casino"),
      slots: items.filter((i) => i.type === "slot"),
      bonuses: items.filter((i) => i.type === "bonus"),
      articles: items.filter((i) => i.type === "article"),
    },
  };
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port, host });
  app.log.info(`API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

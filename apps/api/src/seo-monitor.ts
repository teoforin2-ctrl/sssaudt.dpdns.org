import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin } from "./auth.js";

const BOTS: { id: string; re: RegExp }[] = [
  { id: "google", re: /googlebot|google-inspectiontool|adsbot-google/i },
  { id: "yandex", re: /yandex(bot|images|media)/i },
  { id: "bing", re: /bingbot|msnbot/i },
  { id: "other_bot", re: /bot|crawler|spider|slurp/i },
];

export function classifyBot(ua: string): string | null {
  const s = String(ua || "");
  if (!s) return null;
  for (const b of BOTS) {
    if (b.re.test(s)) return b.id;
  }
  return null;
}

export async function registerSeoMonitor(app: FastifyInstance, pool: Pool, redis: Redis) {
  await pool.query(`
    create table if not exists seo_vitals (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      path text not null,
      locale text not null default 'ru',
      lcp_ms integer,
      inp_ms integer,
      cls numeric(8,4),
      ttfb_ms integer,
      nav_type text
    )
  `).catch(() => undefined);
  await pool.query(`
    create table if not exists seo_bot_hits (
      day date not null,
      bot text not null,
      hits integer not null default 0,
      primary key (day, bot)
    )
  `).catch(() => undefined);

  app.post("/v1/seo/vitals", async (req, reply) => {
    const body = z
      .object({
        path: z.string().max(500),
        locale: z.enum(["ru", "en"]).optional(),
        lcp: z.number().min(0).max(120000).nullable().optional(),
        inp: z.number().min(0).max(120000).nullable().optional(),
        cls: z.number().min(0).max(50).nullable().optional(),
        ttfb: z.number().min(0).max(120000).nullable().optional(),
        navType: z.string().max(40).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const ip = String(req.ip || "0");
    const rlKey = `seo:vitals:rl:${ip}`;
    try {
      const n = await redis.incr(rlKey);
      if (n === 1) await redis.expire(rlKey, 60);
      if (n > 30) return reply.code(429).send({ error: "rate_limited" });
    } catch {
      /* continue */
    }
    const d = body.data;
    const path = d.path.split("?")[0] || "/";
    await pool.query(
      `insert into seo_vitals (path, locale, lcp_ms, inp_ms, cls, ttfb_ms, nav_type)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        path.slice(0, 500),
        d.locale === "en" ? "en" : "ru",
        d.lcp != null ? Math.round(d.lcp) : null,
        d.inp != null ? Math.round(d.inp) : null,
        d.cls != null ? Number(d.cls.toFixed(4)) : null,
        d.ttfb != null ? Math.round(d.ttfb) : null,
        d.navType || null,
      ],
    ).catch((err) => app.log.warn({ err }, "seo_vitals insert failed"));
    return { ok: true };
  });

  app.post("/v1/seo/bot-hit", async (req, reply) => {
    const body = z
      .object({
        ua: z.string().max(400).optional(),
        bot: z.string().max(40).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const bot = body.data.bot || classifyBot(body.data.ua || "");
    if (!bot) return { ok: true, skipped: true };
    await pool.query(
      `insert into seo_bot_hits (day, bot, hits) values (current_date, $1, 1)
       on conflict (day, bot) do update set hits = seo_bot_hits.hits + 1`,
      [bot],
    ).catch(() => undefined);
    return { ok: true };
  });

  app.get("/v1/admin/seo/monitor", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const vitals = await pool
      .query<{
        n: string;
        lcp_p75: string | null;
        inp_p75: string | null;
        cls_p75: string | null;
        ttfb_p75: string | null;
      }>(
        `
        select count(*)::text as n,
               percentile_cont(0.75) within group (order by lcp_ms) filter (where lcp_ms is not null)::text as lcp_p75,
               percentile_cont(0.75) within group (order by inp_ms) filter (where inp_ms is not null)::text as inp_p75,
               percentile_cont(0.75) within group (order by cls) filter (where cls is not null)::text as cls_p75,
               percentile_cont(0.75) within group (order by ttfb_ms) filter (where ttfb_ms is not null)::text as ttfb_p75
        from seo_vitals
        where created_at >= $1
        `,
        [since],
      )
      .catch(() => ({ rows: [] as { n: string; lcp_p75: string | null; inp_p75: string | null; cls_p75: string | null; ttfb_p75: string | null }[] }));

    const bots = await pool
      .query<{ bot: string; hits: string }>(
        `select bot, sum(hits)::text as hits from seo_bot_hits
         where day >= current_date - 7
         group by bot order by sum(hits) desc`,
      )
      .catch(() => ({ rows: [] as { bot: string; hits: string }[] }));

    const v = vitals.rows[0];
    const lcp = v?.lcp_p75 != null ? Number(v.lcp_p75) : null;
    const inp = v?.inp_p75 != null ? Number(v.inp_p75) : null;
    const cls = v?.cls_p75 != null ? Number(v.cls_p75) : null;
    const alerts: string[] = [];
    if (lcp != null && lcp > 2500) alerts.push(`LCP p75 = ${Math.round(lcp)} ms (>2500)`);
    if (inp != null && inp > 200) alerts.push(`INP p75 = ${Math.round(inp)} ms (>200)`);
    if (cls != null && cls > 0.1) alerts.push(`CLS p75 = ${cls.toFixed(3)} (>0.1)`);

    const botHits = bots.rows.map((r) => ({ bot: r.bot, hits: Number(r.hits) }));
    const botTotal = botHits.reduce((s, x) => s + x.hits, 0);

    return {
      windowDays: 7,
      samples: Number(v?.n || 0),
      p75: {
        lcpMs: lcp != null ? Math.round(lcp) : null,
        inpMs: inp != null ? Math.round(inp) : null,
        cls: cls != null ? Number(cls.toFixed(3)) : null,
        ttfbMs: v?.ttfb_p75 != null ? Math.round(Number(v.ttfb_p75)) : null,
      },
      bots: botHits,
      botTotal,
      alerts,
    };
  });
}

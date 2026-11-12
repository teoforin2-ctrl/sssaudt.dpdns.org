import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import sharp from "sharp";
import { z } from "zod";
import { requireAdmin } from "./auth.js";
import { parseImageDataUrl } from "./images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC =
  process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public");
const BRAND_DIR = path.join(WEB_PUBLIC, "uploads", "brand");

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const localeFieldsSchema = z
  .object({
    title: z.string().max(200).optional(),
    description: z.string().max(400).optional(),
    h1: z.string().max(200).optional(),
  })
  .passthrough();

/** New: { ru, en }. Legacy flat { title, description, h1 } still accepted (= RU). */
const templateSchema = z.union([
  z
    .object({
      ru: localeFieldsSchema.optional(),
      en: localeFieldsSchema.optional(),
    })
    .passthrough(),
  localeFieldsSchema,
]);

export const seoSettingsSchema = z
  .object({
    indexingEnabled: z.boolean().optional(),
    canonicalHost: z.string().min(1).max(253).optional(),
    defaultOgImage: z.string().max(500).nullable().optional(),
    defaultOgImageDataUrl: z.string().max(10_000_000).optional(),
    organizationSameAs: z.array(z.string().max(500)).max(20).optional(),
    aiRetrievalAllow: z.boolean().optional(),
    aiTrainingAllow: z.boolean().optional(),
    googleSiteVerification: z.string().max(200).optional(),
    yandexVerification: z.string().max(200).optional(),
    templates: z
      .object({
        home: templateSchema.optional(),
        catalog: templateSchema.optional(),
        casino: templateSchema.optional(),
        slot: templateSchema.optional(),
        bonuses: templateSchema.optional(),
        article: templateSchema.optional(),
        forum: templateSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type SeoLocaleFields = {
  title?: string;
  description?: string;
  h1?: string;
};

export type SeoTemplateI18n = {
  ru: SeoLocaleFields;
  en: SeoLocaleFields;
};

async function saveDefaultOgImage(buf: Buffer): Promise<string> {
  await mkdir(BRAND_DIR, { recursive: true });
  const stamp = Date.now().toString(36);
  const filename = `og-default-${stamp}.webp`;
  const out = await sharp(buf)
    .resize(OG_WIDTH, OG_HEIGHT, {
      fit: "cover",
      position: "centre",
      background: { r: 11, g: 6, b: 18, alpha: 1 },
    })
    .webp({ quality: 90, effort: 4 })
    .toBuffer();
  await writeFile(path.join(BRAND_DIR, filename), out);
  return `/uploads/brand/${filename}`;
}

export type SeoSettings = {
  indexingEnabled: boolean;
  canonicalHost: string;
  defaultOgImage: string | null;
  organizationSameAs: string[];
  aiRetrievalAllow: boolean;
  aiTrainingAllow: boolean;
  googleSiteVerification: string;
  yandexVerification: string;
  templates: Record<string, SeoTemplateI18n>;
};

function cleanVerification(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 200);
}

function cleanField(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function asLocaleFields(v: unknown): SeoLocaleFields {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: SeoLocaleFields = {};
  const title = cleanField(o.title);
  const description = cleanField(o.description);
  const h1 = cleanField(o.h1);
  if (title !== undefined) out.title = title;
  if (description !== undefined) out.description = description;
  if (h1 !== undefined) out.h1 = h1;
  return out;
}

/** Accepts new {ru,en} or legacy flat fields (= RU). */
export function normalizeTemplateEntry(
  val: unknown,
  fallback?: SeoTemplateI18n,
): SeoTemplateI18n {
  const base: SeoTemplateI18n = {
    ru: { ...(fallback?.ru || {}) },
    en: { ...(fallback?.en || {}) },
  };
  if (!val || typeof val !== "object") return base;
  const o = val as Record<string, unknown>;
  if ("ru" in o || "en" in o) {
    return {
      ru: { ...base.ru, ...asLocaleFields(o.ru) },
      en: { ...base.en, ...asLocaleFields(o.en) },
    };
  }
  return {
    ru: { ...base.ru, ...asLocaleFields(o) },
    en: { ...base.en },
  };
}

export const defaultSeoSettings = (): SeoSettings => ({
  indexingEnabled: false,
  canonicalHost: process.env.SITE_HOST || "dfijdsif.website",
  defaultOgImage: "/img/brand/logo.webp",
  organizationSameAs: [],
  aiRetrievalAllow: true,
  aiTrainingAllow: false,
  googleSiteVerification: "",
  yandexVerification: "",
  templates: {
    home: {
      ru: {
        title: "Обзоры онлайн-казино 2026 — рейтинг, бонусы и отзывы — {siteName}",
        description:
          "Редакционные обзоры казино: бонусы, выплаты, отзывы игроков. Честные оценки без обещаний выигрыша. 18+",
        h1: "Рейтинг онлайн-казино",
      },
      en: {
        title: "Online casino reviews 2026 — rankings, bonuses & ratings — {siteName}",
        description:
          "Editorial casino reviews: bonuses, payouts, player feedback. Honest scores with no win promises. 18+",
        h1: "Online casino ranking",
      },
    },
    casino: {
      ru: {
        title: "{casino} — обзор и отзывы игроков 2026 — {siteName}",
        description:
          "Обзор {casino}: бонусы, выплаты, лицензия. Отзывы игроков и редакционная оценка. 18+",
        h1: "{casino} — обзор",
      },
      en: {
        title: "{casino} review & player ratings 2026 — {siteName}",
        description:
          "{casino} review: bonuses, payouts, licence. Player feedback and editorial score. 18+",
        h1: "{casino} review",
      },
    },
    slot: {
      ru: {
        title: "{slot} — обзор слота, RTP и демо — {siteName}",
        description:
          "Обзор слота {slot}: RTP, волатильность, провайдер и демо. Где поиграть онлайн. 18+",
        h1: "{slot}",
      },
      en: {
        title: "{slot} slot review, RTP & demo — {siteName}",
        description:
          "{slot} slot review: RTP, volatility, provider and demo. Where to play online. 18+",
        h1: "{slot}",
      },
    },
    article: {
      ru: {
        title: "{article} — {siteName}",
        description: "{article}. Экспертный материал редакции {siteName}. 18+",
        h1: "{article}",
      },
      en: {
        title: "{article} — {siteName}",
        description: "{article}. Editorial guide from {siteName}. 18+",
        h1: "{article}",
      },
    },
    bonuses: {
      ru: {
        title: "Бонусы казино 2026 — промокоды и фриспины — {siteName}",
        description:
          "Актуальные бонусы казино: вейджер, промокоды, бездепозитные и фриспины. Проверено редакцией. 18+",
        h1: "Бонусы казино",
      },
      en: {
        title: "Casino bonuses 2026 — promo codes & free spins — {siteName}",
        description:
          "Current casino bonuses: wagering, promo codes, no-deposit and free spins. Editor-checked. 18+",
        h1: "Casino bonuses",
      },
    },
    catalog: {
      ru: {
        title: "Рейтинг казино — {siteName}",
        description: "Полный рейтинг онлайн-казино с оценками редакции и отзывами игроков. 18+",
        h1: "Рейтинг казино",
      },
      en: {
        title: "Casino ranking — {siteName}",
        description: "Full online casino ranking with editorial scores and player reviews. 18+",
        h1: "Casino ranking",
      },
    },
    forum: {
      ru: {
        title: "Форум игроков — {siteName}",
        description: "Обсуждения казино, бонусов и выплат на форуме {siteName}. 18+",
        h1: "Форум",
      },
      en: {
        title: "Player forum — {siteName}",
        description: "Casino, bonus and payout discussions on the {siteName} forum. 18+",
        h1: "Forum",
      },
    },
  },
});

export function mapSeoSettings(raw: unknown): SeoSettings {
  const base = defaultSeoSettings();
  const parsed = seoSettingsSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!parsed.success) return base;
  const d = parsed.data;
  const templates: SeoSettings["templates"] = { ...base.templates };
  if (d.templates && typeof d.templates === "object") {
    for (const [key, val] of Object.entries(d.templates)) {
      if (!val || typeof val !== "object") continue;
      templates[key] = normalizeTemplateEntry(val, base.templates[key]);
    }
  }

  return {
    indexingEnabled: d.indexingEnabled ?? base.indexingEnabled,
    canonicalHost: (d.canonicalHost || base.canonicalHost).replace(/^https?:\/\//, "").replace(/\/$/, ""),
    defaultOgImage: d.defaultOgImage === undefined ? base.defaultOgImage : d.defaultOgImage,
    organizationSameAs: d.organizationSameAs ?? base.organizationSameAs,
    aiRetrievalAllow: d.aiRetrievalAllow ?? base.aiRetrievalAllow,
    aiTrainingAllow: d.aiTrainingAllow ?? base.aiTrainingAllow,
    googleSiteVerification: cleanVerification(
      d.googleSiteVerification ?? base.googleSiteVerification,
    ),
    yandexVerification: cleanVerification(d.yandexVerification ?? base.yandexVerification),
    templates,
  };
}

export async function loadSeo(pool: Pool): Promise<SeoSettings> {
  try {
    const { rows } = await pool.query(`select seo_settings from site_settings where id = 1`);
    return mapSeoSettings(rows[0]?.seo_settings);
  } catch {
    return defaultSeoSettings();
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absolute(originOrHost: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(originOrHost)) {
    return `${originOrHost.replace(/\/$/, "")}${p}`;
  }
  return `https://${originOrHost.replace(/\/$/, "")}${p}`;
}

/** Local requests get localhost locs (clickable). Prod always uses canonical https host. */
function publicOrigin(req: FastifyRequest, canonicalHost: string): string {
  const xfHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const rawHost = xfHost || String(req.headers.host || "").trim();
  const hostOnly = rawHost.split(":")[0] || "";
  if (/^(localhost|127\.0\.0\.1)$/i.test(hostOnly)) {
    const xfProto = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const proto = xfProto === "https" ? "https" : "http";
    return `${proto}://${rawHost}`;
  }
  return `https://${canonicalHost}`;
}

function buildRobotsTxt(seo: SeoSettings): string {
  const host = seo.canonicalHost;
  if (!seo.indexingEnabled) {
    return [
      "User-agent: *",
      "Disallow: /",
      "",
      `# Indexing disabled in admin SEO settings`,
      `Sitemap: ${absolute(host, "/sitemap.xml")}`,
      "",
    ].join("\n");
  }

  const retrieval = seo.aiRetrievalAllow
    ? [
        "User-agent: OAI-SearchBot",
        "User-agent: PerplexityBot",
        "User-agent: Claude-SearchBot",
        "User-agent: Applebot",
        "User-agent: Amzn-SearchBot",
        "User-agent: MistralAI-Index",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /v1/",
        "Disallow: /go/",
        "Disallow: /admin",
        "Disallow: /partner",
        "Disallow: /search",
        "",
      ]
    : [
        "User-agent: OAI-SearchBot",
        "User-agent: PerplexityBot",
        "User-agent: Claude-SearchBot",
        "Disallow: /",
        "",
      ];

  const training = seo.aiTrainingAllow
    ? []
    : [
        "User-agent: GPTBot",
        "User-agent: ClaudeBot",
        "User-agent: Google-Extended",
        "User-agent: CCBot",
        "User-agent: Bytespider",
        "Disallow: /",
        "",
      ];

  return [
    "User-agent: Googlebot",
    "User-agent: Googlebot-Image",
    "User-agent: Bingbot",
    "User-agent: YandexBot",
    "User-agent: YandexImages",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /v1/",
    "Disallow: /admin",
    "Disallow: /partner",
    "Disallow: /auth/",
    "Disallow: /login",
    "Disallow: /go/",
    "Disallow: /search",
    "Disallow: /*?utm_",
    "Disallow: /*?sort=",
    "Disallow: /*?ref=",
    "",
    ...retrieval,
    ...training,
    "User-agent: AhrefsBot",
    "User-agent: SemrushBot",
    "Crawl-delay: 2",
    "Allow: /",
    "",
    `Sitemap: ${absolute(host, "/sitemap.xml")}`,
    "",
    "User-agent: YandexBot",
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&gclid&yclid&fbclid&sort&ref",
    "",
  ].join("\n");
}

type UrlRow = {
  loc: string;
  lastmod?: string | null;
  alternates?: { hreflang: string; href: string }[];
};

function urlset(rows: UrlRow[]): string {
  const body = rows
    .map((r) => {
      const last = r.lastmod
        ? `\n    <lastmod>${escapeXml(new Date(r.lastmod).toISOString())}</lastmod>`
        : "";
      const alts = (r.alternates || [])
        .map(
          (a) =>
            `\n    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}" />`,
        )
        .join("");
      return `  <url>\n    <loc>${escapeXml(r.loc)}</loc>${last}${alts}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

function withAlternates(
  origin: string,
  locale: "ru" | "en",
  path: string,
  lastmod?: string | null,
): UrlRow {
  const locRu =
    path === "/"
      ? absolute(origin, "/")
      : absolute(origin, `/ru${path}`);
  const locEn =
    path === "/"
      ? absolute(origin, "/en")
      : absolute(origin, `/en${path}`);
  const loc = locale === "en" ? locEn : locRu;
  return {
    loc,
    lastmod,
    alternates: [
      { hreflang: "ru", href: locRu },
      { hreflang: "en", href: locEn },
      { hreflang: "x-default", href: locRu },
    ],
  };
}

function sitemapIndex(origin: string, files: string[]): string {
  const body = files
    .map(
      (f) =>
        `  <sitemap>\n    <loc>${escapeXml(absolute(origin, f))}</loc>\n  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

const SITEMAP_CHUNKS = [
  "/sitemaps/pages-ru.xml",
  "/sitemaps/pages-en.xml",
  "/sitemaps/casinos-ru.xml",
  "/sitemaps/casinos-en.xml",
  "/sitemaps/slots-ru.xml",
  "/sitemaps/slots-en.xml",
  "/sitemaps/bonuses-ru.xml",
  "/sitemaps/bonuses-en.xml",
  "/sitemaps/articles-ru.xml",
  "/sitemaps/articles-en.xml",
  "/sitemaps/forum-ru.xml",
  "/sitemaps/forum-en.xml",
] as const;

const STATIC_PAGES = [
  "/",
  "/about",
  "/faq",
  "/methodology",
  "/editorial",
  "/contacts",
  "/bonuses",
  "/slots",
  "/rating",
  "/articles",
  "/authors",
  "/complaints",
  "/progress",
  "/b2b",
  "/legal",
  "/legal/privacy",
  "/legal/cookies",
  "/legal/responsible-gambling",
  "/legal/affiliate-disclosure",
  "/legal/18-plus",
];

export async function registerSeo(app: FastifyInstance, pool: Pool) {
  app.get("/robots.txt", async (_req, reply) => {
    const seo = await loadSeo(pool);
    reply.header("Content-Type", "text/plain; charset=utf-8");
    // Short TTL — indexing toggle must take effect quickly (avoid empty/stale browser cache).
    reply.header("Cache-Control", "public, max-age=60, must-revalidate");
    if (!seo.indexingEnabled) {
      reply.header("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    }
    return buildRobotsTxt(seo);
  });

  app.get("/sitemap.xml", async (req, reply) => {
    const seo = await loadSeo(pool);
    reply.header("Content-Type", "application/xml; charset=utf-8");
    // Do NOT long-cache: empty→full flip after SEO changes was invisible in Chrome for 1h.
    reply.header("Cache-Control", "public, max-age=60, must-revalidate");
    reply.header("CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    // Always emit the full index so ops can verify generation.
    // Crawl gate is robots.txt + meta/X-Robots when indexingEnabled=false.
    if (!seo.indexingEnabled) {
      reply.header("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    }
    const origin = publicOrigin(req, seo.canonicalHost);
    return sitemapIndex(origin, [...SITEMAP_CHUNKS]);
  });

  app.get("/sitemaps/:name", async (req, reply) => {
    const seo = await loadSeo(pool);
    const name = String((req.params as { name: string }).name || "").replace(/\.xml$/i, "");
    reply.header("Content-Type", "application/xml; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=60, must-revalidate");
    reply.header("CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    if (!seo.indexingEnabled) {
      reply.header("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    }

    const origin = publicOrigin(req, seo.canonicalHost);
    const now = new Date().toISOString();

    try {
      if (name === "pages-ru" || name === "pages-en") {
        const locale = name.endsWith("en") ? "en" : "ru";
        return urlset(STATIC_PAGES.map((p) => withAlternates(origin, locale, p, now)));
      }

      if (name === "casinos-ru" || name === "casinos-en") {
        const locale = name.endsWith("en") ? "en" : "ru";
        const { rows } = await pool.query(
          `select slug, updated_at from casinos where status = 'published' order by updated_at desc nulls last limit 50000`,
        );
        return urlset(
          rows.map((r) => withAlternates(origin, locale, `/casino/${r.slug}`, r.updated_at)),
        );
      }

      if (name === "slots-ru" || name === "slots-en") {
        const locale = name.endsWith("en") ? "en" : "ru";
        const { rows } = await pool.query(
          `select slug, created_at as updated_at from slots where status = 'published' order by created_at desc nulls last limit 50000`,
        );
        return urlset(
          rows.map((r) => withAlternates(origin, locale, `/slots/${r.slug}`, r.updated_at)),
        );
      }

      if (name === "bonuses-ru" || name === "bonuses-en") {
        const locale = name.endsWith("en") ? "en" : "ru";
        const hubs = ["", "/welcome", "/no-deposit", "/free-spins", "/codes"];
        return urlset(
          hubs.map((h) => withAlternates(origin, locale, `/bonuses${h}`, now)),
        );
      }

      if (name === "articles-ru" || name === "articles-en") {
        const locale = name.endsWith("en") ? "en" : "ru";
        const { rows } = await pool.query(
          `select slug, coalesce(updated_at, published_at) as updated_at
           from articles where status = 'published'
           order by published_at desc nulls last limit 50000`,
        );
        return urlset(
          rows.map((r) => withAlternates(origin, locale, `/articles/${r.slug}`, r.updated_at)),
        );
      }

      if (name === "forum-ru" || name === "forum-en") {
        const locale = name.endsWith("en") ? "en" : "ru";
        const { rows } = await pool.query(
          `select slug, updated_at from forum_topics
           where status = 'published'
           order by last_post_at desc nulls last limit 50000`,
        );
        return urlset([
          withAlternates(origin, locale, "/forum", now),
          ...rows.map((r) =>
            withAlternates(origin, locale, `/forum/tema/${r.slug}`, r.updated_at),
          ),
        ]);
      }
    } catch (err) {
      app.log.error({ err, name }, "sitemap chunk failed");
      return reply.code(500).send("sitemap error");
    }

    return reply.code(404).send("not found");
  });

  app.get("/v1/seo", async () => {
    const seo = await loadSeo(pool);
    return { seo };
  });

  app.get("/v1/admin/seo/sitemap-status", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const seo = await loadSeo(pool);
    const counts: Record<string, number> = {};
    try {
      const { rows: casinos } = await pool.query(
        `select count(*)::int as n from casinos where status = 'published'`,
      );
      const { rows: slots } = await pool.query(
        `select count(*)::int as n from slots where status = 'published'`,
      );
      const { rows: articles } = await pool.query(
        `select count(*)::int as n from articles where status = 'published'`,
      );
      const { rows: forum } = await pool.query(
        `select count(*)::int as n from forum_topics where status = 'published'`,
      );
      counts.pages = STATIC_PAGES.length * 2;
      counts.casinos = Number(casinos[0]?.n || 0) * 2;
      counts.slots = Number(slots[0]?.n || 0) * 2;
      counts.bonuses = 5 * 2;
      counts.articles = Number(articles[0]?.n || 0) * 2;
      counts.forum = (1 + Number(forum[0]?.n || 0)) * 2;
    } catch (err) {
      app.log.error({ err }, "sitemap-status failed");
      return reply.code(500).send({ error: "sitemap_status_failed" });
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      indexingEnabled: seo.indexingEnabled,
      canonicalHost: seo.canonicalHost,
      chunks: [
        "pages-ru",
        "pages-en",
        "casinos-ru",
        "casinos-en",
        "slots-ru",
        "slots-en",
        "bonuses-ru",
        "bonuses-en",
        "articles-ru",
        "articles-en",
        "forum-ru",
        "forum-en",
      ],
      counts,
      totalUrls: total,
      servedWhenIndexingOff: true,
      note: seo.indexingEnabled
        ? "Sitemap index lists entity chunks with live DB URLs."
        : "Indexing off → robots Disallow + noindex, but sitemap still generated for verification.",
    };
  });

  app.patch("/v1/admin/seo", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = seoSettingsSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }

    await pool.query(`insert into site_settings (id) values (1) on conflict (id) do nothing`);
    const { rows: cur } = await pool.query(`select seo_settings from site_settings where id = 1`);
    const current = mapSeoSettings(cur[0]?.seo_settings);

    let defaultOgImage = body.data.defaultOgImage === undefined
      ? current.defaultOgImage
      : body.data.defaultOgImage;

    if (body.data.defaultOgImageDataUrl) {
      const parsed = parseImageDataUrl(body.data.defaultOgImageDataUrl);
      if (!parsed || parsed.ext === "svg") {
        return reply.code(400).send({ error: "invalid_og_image" });
      }
      try {
        defaultOgImage = await saveDefaultOgImage(parsed.buf);
      } catch (err) {
        app.log.error({ err }, "og image save failed");
        return reply.code(400).send({ error: "og_image_process_failed" });
      }
    }

    const patch: Record<string, unknown> = {
      ...current,
      defaultOgImage,
      templates: { ...current.templates, ...(body.data.templates || {}) },
    };
    if (body.data.indexingEnabled !== undefined) patch.indexingEnabled = body.data.indexingEnabled;
    if (body.data.canonicalHost !== undefined) patch.canonicalHost = body.data.canonicalHost;
    if (body.data.organizationSameAs !== undefined) patch.organizationSameAs = body.data.organizationSameAs;
    if (body.data.aiRetrievalAllow !== undefined) patch.aiRetrievalAllow = body.data.aiRetrievalAllow;
    if (body.data.aiTrainingAllow !== undefined) patch.aiTrainingAllow = body.data.aiTrainingAllow;
    if (body.data.googleSiteVerification !== undefined) {
      patch.googleSiteVerification = body.data.googleSiteVerification;
    }
    if (body.data.yandexVerification !== undefined) {
      patch.yandexVerification = body.data.yandexVerification;
    }

    const next = mapSeoSettings(patch);

    const { rows } = await pool.query(
      `
      update site_settings
      set seo_settings = $1::jsonb, updated_at = now()
      where id = 1
      returning seo_settings
      `,
      [JSON.stringify(next)],
    );
    return { seo: mapSeoSettings(rows[0]?.seo_settings) };
  });
}

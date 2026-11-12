import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import sharp from "sharp";
import { z } from "zod";
import { mergeRewardSettings, type RewardSettings } from "@x-reviewer/shared";
import { requireAdmin, requireStaff } from "./auth.js";
import { parseImageDataUrl, saveRasterAsWebp } from "./images.js";
import { mapSeoSettings, type SeoSettings } from "./seo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC =
  process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public");
const BRAND_DIR = path.join(WEB_PUBLIC, "uploads", "brand");

const contactsSchema = z
  .object({
    email: z.string().max(320).optional().default(""),
    email_partners: z.string().max(320).optional().default(""),
    telegram: z.string().max(500).optional().default(""),
    vk: z.string().max(500).optional().default(""),
    youtube: z.string().max(500).optional().default(""),
    x: z.string().max(500).optional().default(""),
    instagram: z.string().max(500).optional().default(""),
    facebook: z.string().max(500).optional().default(""),
    discord: z.string().max(500).optional().default(""),
  })
  .passthrough();

export type SiteContacts = z.infer<typeof contactsSchema>;

const defaultHomeSections = {
  heroStats: true,
  heroBanners: true,
  listing: true,
  aside: true,
  slots: true,
  promoBanner: true,
  newSlots: true,
  articles: true,
  guides: true,
  partnerBrands: false,
  expert: true,
  trust: true,
  communityStats: true,
  method: true,
  homeBonuses: true,
  homeForum: true,
  homeB2b: true,
} as const;

const homeSectionsSchema = z
  .object({
    heroStats: z.boolean().optional(),
    heroBanners: z.boolean().optional(),
    listing: z.boolean().optional(),
    aside: z.boolean().optional(),
    slots: z.boolean().optional(),
    promoBanner: z.boolean().optional(),
    newSlots: z.boolean().optional(),
    articles: z.boolean().optional(),
    guides: z.boolean().optional(),
    partnerBrands: z.boolean().optional(),
    expert: z.boolean().optional(),
    trust: z.boolean().optional(),
    communityStats: z.boolean().optional(),
    method: z.boolean().optional(),
    homeBonuses: z.boolean().optional(),
    homeForum: z.boolean().optional(),
    homeB2b: z.boolean().optional(),
  })
  .passthrough();

export type HomeSections = typeof defaultHomeSections & Record<string, boolean>;

export type SiteSettings = {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  favicon32Url: string | null;
  appleTouchIconUrl: string | null;
  contacts: SiteContacts;
  homeSections: HomeSections;
  rewardSettings: RewardSettings;
  seo: SeoSettings;
  updatedAt: string | null;
};

function mapHomeSections(raw: unknown): HomeSections {
  const parsed = homeSectionsSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return { ...defaultHomeSections, ...(parsed.success ? parsed.data : {}) } as HomeSections;
}

function mapRow(row: Record<string, unknown>): SiteSettings {
  const contactsRaw = row.contacts && typeof row.contacts === "object" ? row.contacts : {};
  const contacts = contactsSchema.parse(contactsRaw);
  return {
    siteName: String(row.site_name || "SS Audit"),
    logoUrl: (row.logo_url as string | null) || null,
    faviconUrl: (row.favicon_url as string | null) || null,
    favicon32Url: (row.favicon_32_url as string | null) || null,
    appleTouchIconUrl: (row.apple_touch_icon_url as string | null) || null,
    contacts,
    homeSections: mapHomeSections(row.home_sections),
    rewardSettings: mergeRewardSettings(row.reward_settings),
    seo: mapSeoSettings(row.seo_settings),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

async function saveLogoSvg(buf: Buffer): Promise<string> {
  await mkdir(BRAND_DIR, { recursive: true });
  const stamp = Date.now().toString(36);
  const filename = `logo-${stamp}.svg`;
  await writeFile(path.join(BRAND_DIR, filename), buf);
  return `/uploads/brand/${filename}`;
}

async function saveLogoWebp(buf: Buffer): Promise<string> {
  const stamp = Date.now().toString(36);
  return saveRasterAsWebp({
    dir: BRAND_DIR,
    basename: `logo-${stamp}`,
    buf,
    publicPathPrefix: "/uploads/brand",
  });
}

async function regenerateFavicons(source: Buffer): Promise<{
  faviconUrl: string;
  favicon32Url: string;
  appleTouchIconUrl: string;
}> {
  await mkdir(BRAND_DIR, { recursive: true });
  const stamp = Date.now().toString(36);
  const base = sharp(source).ensureAlpha();

  const fav512 = await base.clone().resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const fav32 = await base.clone().resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const apple = await base.clone().resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const faviconName = `favicon-${stamp}.png`;
  const fav32Name = `favicon-32-${stamp}.png`;
  const appleName = `apple-touch-${stamp}.png`;

  await writeFile(path.join(BRAND_DIR, faviconName), fav512);
  await writeFile(path.join(BRAND_DIR, fav32Name), fav32);
  await writeFile(path.join(BRAND_DIR, appleName), apple);

  return {
    faviconUrl: `/uploads/brand/${faviconName}`,
    favicon32Url: `/uploads/brand/${fav32Name}`,
    appleTouchIconUrl: `/uploads/brand/${appleName}`,
  };
}

async function ensureRow(pool: Pool) {
  await pool.query(
    `
    insert into site_settings (id) values (1)
    on conflict (id) do nothing
    `,
  );
}

export async function registerSiteSettings(app: FastifyInstance, pool: Pool) {
  app.get("/v1/site-settings", async () => {
    try {
      await ensureRow(pool);
      const { rows } = await pool.query(`select * from site_settings where id = 1`);
      return { settings: mapRow(rows[0] || {}) };
    } catch (err) {
      app.log.error({ err }, "site-settings get failed");
      return {
        settings: mapRow({
          site_name: "SS Audit",
          logo_url: "/img/brand/logo.webp",
          favicon_url: "/favicon.png",
          favicon_32_url: "/favicon-32.png",
          apple_touch_icon_url: "/apple-touch-icon.png",
          contacts: {},
          seo_settings: {},
        }),
      };
    }
  });

  app.get("/v1/admin/site-settings", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    await ensureRow(pool);
    const { rows } = await pool.query(`select * from site_settings where id = 1`);
    return { settings: mapRow(rows[0] || {}) };
  });

  app.patch("/v1/admin/site-settings", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        site_name: z.string().min(1).max(120).optional(),
        logo_data_url: z.string().max(10_000_000).optional(),
        favicon_data_url: z.string().max(10_000_000).optional(),
        regenerate_favicon_from_logo: z.boolean().optional(),
        contacts: contactsSchema.optional(),
        home_sections: homeSectionsSchema.optional(),
        reward_settings: z.record(z.unknown()).optional(),
      })
      .safeParse(req.body);

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }

    // Editors may only toggle home section visibility; brand/rewards are admin-only.
    const adminOnly =
      body.data.site_name !== undefined
      || body.data.logo_data_url !== undefined
      || body.data.favicon_data_url !== undefined
      || body.data.regenerate_favicon_from_logo !== undefined
      || body.data.contacts !== undefined
      || body.data.reward_settings !== undefined;
    if (adminOnly && !requireAdmin(req, reply)) {
      return;
    }

    await ensureRow(pool);
    const { rows: curRows } = await pool.query(`select * from site_settings where id = 1`);
    const current = mapRow(curRows[0] || {});

    let logoUrl = current.logoUrl;
    let faviconUrl = current.faviconUrl;
    let favicon32Url = current.favicon32Url;
    let appleTouchIconUrl = current.appleTouchIconUrl;
    let logoBuf: Buffer | null = null;

    if (body.data.logo_data_url) {
      const parsed = parseImageDataUrl(body.data.logo_data_url);
      if (!parsed) return reply.code(400).send({ error: "invalid_logo" });
      if (parsed.ext === "svg") {
        logoUrl = await saveLogoSvg(parsed.buf);
        // rasterize svg for favicon via sharp if possible
        try {
          logoBuf = await sharp(parsed.buf).png().toBuffer();
        } catch {
          logoBuf = null;
        }
      } else {
        logoBuf = parsed.buf;
        try {
          logoUrl = await saveLogoWebp(parsed.buf);
        } catch {
          return reply.code(400).send({ error: "invalid_logo" });
        }
      }
    }

    let faviconSource: Buffer | null = null;
    if (body.data.favicon_data_url) {
      const parsed = parseImageDataUrl(body.data.favicon_data_url);
      if (!parsed) return reply.code(400).send({ error: "invalid_favicon" });
      if (parsed.ext === "svg") {
        try {
          faviconSource = await sharp(parsed.buf).png().toBuffer();
        } catch {
          return reply.code(400).send({ error: "invalid_favicon" });
        }
      } else {
        faviconSource = parsed.buf;
      }
    } else if (body.data.regenerate_favicon_from_logo !== false && logoBuf) {
      faviconSource = logoBuf;
    }

    if (faviconSource) {
      try {
        const generated = await regenerateFavicons(faviconSource);
        faviconUrl = generated.faviconUrl;
        favicon32Url = generated.favicon32Url;
        appleTouchIconUrl = generated.appleTouchIconUrl;
      } catch (err) {
        app.log.error({ err }, "favicon regenerate failed");
        return reply.code(400).send({ error: "favicon_generate_failed" });
      }
    }

    const siteName = body.data.site_name?.trim() || current.siteName;
    const contacts = body.data.contacts
      ? contactsSchema.parse({ ...current.contacts, ...body.data.contacts })
      : current.contacts;
    const homeSections = body.data.home_sections
      ? mapHomeSections({ ...current.homeSections, ...body.data.home_sections })
      : current.homeSections;
    const rewardSettings = body.data.reward_settings
      ? mergeRewardSettings({ ...current.rewardSettings, ...body.data.reward_settings })
      : current.rewardSettings;

    const { rows } = await pool.query(
      `
      update site_settings set
        site_name = $1,
        logo_url = $2,
        favicon_url = $3,
        favicon_32_url = $4,
        apple_touch_icon_url = $5,
        contacts = $6::jsonb,
        home_sections = $7::jsonb,
        reward_settings = $8::jsonb,
        updated_at = now()
      where id = 1
      returning *
      `,
      [
        siteName,
        logoUrl,
        faviconUrl,
        favicon32Url,
        appleTouchIconUrl,
        JSON.stringify(contacts),
        JSON.stringify(homeSections),
        JSON.stringify(rewardSettings),
      ],
    );

    return { settings: mapRow(rows[0]) };
  });
}

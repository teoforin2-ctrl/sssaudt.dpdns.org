import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { requireAdmin } from "./auth.js";
import { bumpCasinoCache } from "./cache.js";
import { mapSeoSettings } from "./seo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC =
  process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public");
const INDEXNOW_KEY_PATH = path.join(WEB_PUBLIC, "indexnow-key.txt");

export type SeoPipelineEvent = {
  at: string;
  action: "publish" | "update" | "unpublish" | "delete" | "manual";
  kind: string;
  slug: string;
  urls: string[];
  indexNow?: { ok: boolean; status?: number; error?: string };
  cacheBump?: { ok: boolean };
  cloudflare?: { ok: boolean; skipped?: boolean; status?: number; error?: string };
};

const recentEvents: SeoPipelineEvent[] = [];
const MAX_EVENTS = 100;

function pushEvent(ev: SeoPipelineEvent) {
  recentEvents.unshift(ev);
  if (recentEvents.length > MAX_EVENTS) recentEvents.length = MAX_EVENTS;
}

async function loadSeoHost(pool: Pool): Promise<{ host: string; indexingEnabled: boolean }> {
  try {
    const { rows } = await pool.query(`select seo_settings from site_settings where id = 1`);
    const seo = mapSeoSettings(rows[0]?.seo_settings);
    return { host: seo.canonicalHost, indexingEnabled: seo.indexingEnabled };
  } catch {
    return { host: process.env.SITE_HOST || "dfijdsif.website", indexingEnabled: false };
  }
}

async function ensureIndexNowKey(): Promise<string> {
  try {
    const existing = (await readFile(INDEXNOW_KEY_PATH, "utf8")).trim();
    if (/^[a-f0-9]{8,128}$/i.test(existing)) return existing;
  } catch {
    /* create */
  }
  await mkdir(WEB_PUBLIC, { recursive: true });
  const key = createHash("sha256").update(randomBytes(32)).digest("hex").slice(0, 32);
  await writeFile(INDEXNOW_KEY_PATH, key, "utf8");
  // IndexNow also requires key file at https://host/{key}.txt
  await writeFile(path.join(WEB_PUBLIC, `${key}.txt`), key, "utf8");
  return key;
}

function absoluteUrls(host: string, paths: string[]): string[] {
  const origin = `https://${host.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const out: string[] = [];
  for (const p of paths) {
    const clean = p.startsWith("/") ? p : `/${p}`;
    out.push(`${origin}${clean}`);
  }
  return [...new Set(out)];
}

/** Build bilingual public URLs for an entity. */
export function entitySeoUrls(kind: string, slug: string): string[] {
  const k = kind.toLowerCase();
  if (k === "casino") return [`/ru/casino/${slug}`, `/en/casino/${slug}`];
  if (k === "slot") return [`/ru/slots/${slug}`, `/en/slots/${slug}`];
  if (k === "article") return [`/ru/articles/${slug}`, `/en/articles/${slug}`];
  if (k === "home") return ["/", "/en"];
  if (k === "bonuses") return ["/ru/bonuses", "/en/bonuses"];
  if (k === "rating" || k === "catalog") return ["/ru/rating", "/en/rating"];
  return [`/ru/${slug}`, `/en/${slug}`];
}

async function purgeCloudflare(urls: string[]): Promise<SeoPipelineEvent["cloudflare"]> {
  const zone = process.env.CF_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || "";
  const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "";
  if (!zone || !token) return { ok: true, skipped: true };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls.slice(0, 30) }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text().catch(() => "");
    return {
      ok: res.ok,
      status: res.status,
      error: res.ok ? undefined : text.slice(0, 240) || `http_${res.status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "cf_purge_failed" };
  }
}

let pipelineRedis: Redis | null = null;

export async function runSeoPipeline(
  pool: Pool,
  opts: {
    action: SeoPipelineEvent["action"];
    kind: string;
    slug: string;
    paths?: string[];
  },
): Promise<SeoPipelineEvent> {
  const { host, indexingEnabled } = await loadSeoHost(pool);
  const paths = opts.paths?.length ? opts.paths : entitySeoUrls(opts.kind, opts.slug);
  const urls = absoluteUrls(host, paths);
  const ev: SeoPipelineEvent = {
    at: new Date().toISOString(),
    action: opts.action,
    kind: opts.kind,
    slug: opts.slug,
    urls,
  };

  if (pipelineRedis) {
    try {
      await bumpCasinoCache(pipelineRedis);
      ev.cacheBump = { ok: true };
    } catch {
      ev.cacheBump = { ok: false };
    }
  }

  ev.cloudflare = await purgeCloudflare(urls);

  if (!indexingEnabled) {
    ev.indexNow = { ok: false, error: "indexing_disabled" };
    pushEvent(ev);
    return ev;
  }

  try {
    const key = await ensureIndexNowKey();
    const keyLocation = `https://${host.replace(/^https?:\/\//, "")}/${key}.txt`;
    const body = {
      host: host.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      key,
      keyLocation,
      urlList: urls.slice(0, 100),
    };
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    ev.indexNow = {
      ok: res.status === 200 || res.status === 202,
      status: res.status,
      error: res.ok ? undefined : await res.text().catch(() => `http_${res.status}`),
    };
  } catch (err) {
    ev.indexNow = {
      ok: false,
      error: err instanceof Error ? err.message : "indexnow_failed",
    };
  }

  pushEvent(ev);
  return ev;
}

export async function registerSeoPipeline(app: FastifyInstance, pool: Pool, redis?: Redis) {
  pipelineRedis = redis ?? null;
  app.get("/v1/admin/seo/pipeline", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const key = await ensureIndexNowKey().catch(() => null);
    return {
      indexNowKey: key,
      keyFileUrl: key ? `/${key}.txt` : null,
      events: recentEvents.slice(0, 40),
    };
  });

  app.post("/v1/admin/seo/pipeline/ping", async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const body = (req.body || {}) as { kind?: string; slug?: string; paths?: string[] };
    const kind = String(body.kind || "home");
    const slug = String(body.slug || "");
    const event = await runSeoPipeline(pool, {
      action: "manual",
      kind,
      slug,
      paths: Array.isArray(body.paths) ? body.paths.map(String) : undefined,
    });
    return { event };
  });
}

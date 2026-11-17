import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC =
  process.env.WEB_PUBLIC_DIR || path.resolve(__dirname, "../../web/public");
const OG_DIR = path.join(WEB_PUBLIC, "uploads", "og");
const OG_W = 1200;
const OG_H = 630;

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapTitle(title: string, maxLen = 54): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= 3) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < 3) lines.push(cur);
  if (lines.length === 3 && words.join(" ").length > lines.join(" ").length) {
    lines[2] = `${lines[2].slice(0, Math.max(1, maxLen - 1))}…`;
  }
  return lines.slice(0, 3);
}

async function resolveLocalImage(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const rel = url.startsWith("/") ? url.slice(1) : url;
    const filePath = path.join(WEB_PUBLIC, rel);
    await access(filePath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function buildOgCard(opts: {
  title: string;
  kindLabel: string;
  siteName: string;
  imageBuf?: Buffer | null;
}): Promise<Buffer> {
  const lines = wrapTitle(opts.title);
  const lineSvgs = lines
    .map(
      (line, i) =>
        `<text x="72" y="${220 + i * 58}" font-size="48" font-weight="700" fill="#f4f0ea" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`,
    )
    .join("\n");

  let logoOverlay = "";
  if (opts.imageBuf && opts.imageBuf.length) {
    try {
      const logo = await sharp(opts.imageBuf)
        .resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const b64 = logo.toString("base64");
      logoOverlay = `<image x="968" y="72" width="160" height="160" href="data:image/png;base64,${b64}" />`;
    } catch {
      logoOverlay = "";
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0612"/>
      <stop offset="55%" stop-color="#161022"/>
      <stop offset="100%" stop-color="#1f1630"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="100%" fill="#3dd6c6"/>
  <text x="72" y="96" font-size="22" font-weight="600" fill="#3dd6c6" font-family="Arial, Helvetica, sans-serif" letter-spacing="2">${escapeXml(opts.kindLabel.toUpperCase())}</text>
  ${lineSvgs}
  <text x="72" y="560" font-size="24" font-weight="600" fill="#a8a29a" font-family="Arial, Helvetica, sans-serif">${escapeXml(opts.siteName)} · 18+</text>
  ${logoOverlay}
</svg>`;

  return sharp(Buffer.from(svg)).webp({ quality: 88, effort: 4 }).toBuffer();
}

export async function registerOg(app: FastifyInstance, pool: Pool) {
  await mkdir(OG_DIR, { recursive: true });

  app.get<{ Params: { kind: string; slug: string } }>(
    "/v1/og/:kind/:slug",
    async (req, reply) => {
      const kind = String(req.params.kind || "").toLowerCase();
      const slug = String(req.params.slug || "").replace(/\.webp$/i, "");
      const locale = String((req.query as { locale?: string }).locale || "ru").toLowerCase();
      const lang = locale.startsWith("en") ? "en" : "ru";

      if (!["casino", "slot", "article"].includes(kind) || !slug) {
        return reply.code(400).send({ error: "invalid_og_request" });
      }

      let title = slug;
      let kindLabel = kind;
      let imageUrl: string | null = null;
      let siteName = "SSS Audit";

      try {
        const { rows: siteRows } = await pool.query(
          `select coalesce(site_name, 'SSS Audit') as site_name from site_settings where id = 1`,
        );
        if (siteRows[0]?.site_name) siteName = String(siteRows[0].site_name);
      } catch {
        /* ignore */
      }

      try {
        if (kind === "casino") {
          const { rows } = await pool.query(
            `select coalesce(nullif(name_${lang}, ''), name) as title, logo_url, seo
             from casinos where slug = $1 and status = 'published' limit 1`,
            [slug],
          );
          if (!rows[0]) return reply.code(404).send({ error: "not_found" });
          title = rows[0].title;
          kindLabel = lang === "en" ? "Casino review" : "Обзор казино";
          const seo = rows[0].seo && typeof rows[0].seo === "object" ? rows[0].seo as Record<string, unknown> : {};
          imageUrl = (typeof seo.ogImage === "string" && seo.ogImage) || rows[0].logo_url || null;
        } else if (kind === "slot") {
          const { rows } = await pool.query(
            `select title, seo from slots where slug = $1 and status = 'published' limit 1`,
            [slug],
          );
          if (!rows[0]) return reply.code(404).send({ error: "not_found" });
          title = rows[0].title;
          kindLabel = lang === "en" ? "Slot review" : "Обзор слота";
          const seo = rows[0].seo && typeof rows[0].seo === "object" ? rows[0].seo as Record<string, unknown> : {};
          imageUrl = typeof seo.ogImage === "string" ? seo.ogImage : null;
        } else {
          const { rows } = await pool.query(
            `select title_${lang} as title, cover_url, seo
             from articles where slug = $1 and status = 'published' limit 1`,
            [slug],
          );
          if (!rows[0]) return reply.code(404).send({ error: "not_found" });
          title = rows[0].title;
          kindLabel = lang === "en" ? "Article" : "Статья";
          const seo = rows[0].seo && typeof rows[0].seo === "object" ? rows[0].seo as Record<string, unknown> : {};
          imageUrl = (typeof seo.ogImage === "string" && seo.ogImage) || rows[0].cover_url || null;
        }
      } catch (err) {
        app.log.error({ err, kind, slug }, "og lookup failed");
        return reply.code(500).send({ error: "og_failed" });
      }

      const cacheKey = createHash("sha1")
        .update(`${kind}|${slug}|${lang}|${title}|${imageUrl || ""}|${siteName}`)
        .digest("hex")
        .slice(0, 16);
      const cacheFile = path.join(OG_DIR, `${kind}-${slug}-${lang}-${cacheKey}.webp`);

      try {
        await access(cacheFile);
        const cached = await readFile(cacheFile);
        reply.header("Content-Type", "image/webp");
        reply.header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return reply.send(cached);
      } catch {
        /* generate */
      }

      const imageBuf = await resolveLocalImage(imageUrl);
      const out = await buildOgCard({ title, kindLabel, siteName, imageBuf });
      try {
        await writeFile(cacheFile, out);
      } catch {
        /* ignore cache write */
      }
      reply.header("Content-Type", "image/webp");
      reply.header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      return reply.send(out);
    },
  );
}

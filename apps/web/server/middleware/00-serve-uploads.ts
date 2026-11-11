/**
 * Serve runtime-mounted upload dirs from disk.
 *
 * Nitro only registers public files present at build time. Admin uploads land in
 * Docker bind-mounts under `.output/public/uploads/{articles,banners,brand,content}`
 * after start — without this handler Nuxt returns SPA 404 for those URLs.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { sendStream, setResponseHeader } from "h3";

const UPLOAD_RE = /^\/uploads\/(articles|banners|brand|content)\/(.+)$/i;

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function uploadsRoot(): string {
  // Docker web: /app/.output/public/uploads ; local nuxt dev: apps/web/public/uploads
  const fromEnv = process.env.WEB_UPLOADS_ROOT?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), ".output/public/uploads");
}

function resolveUploadFile(folder: string, rest: string): string | null {
  const safeRest = normalize(rest).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!safeRest || safeRest.startsWith("..") || safeRest.includes(`..${sep}`)) return null;
  const file = join(uploadsRoot(), folder, safeRest);
  const root = join(uploadsRoot(), folder);
  if (!file.startsWith(root + sep) && file !== root) return null;
  if (!existsSync(file)) return null;
  try {
    if (!statSync(file).isFile()) return null;
  } catch {
    return null;
  }
  return file;
}

export default defineEventHandler((event) => {
  const path = event.path || "";
  const m = UPLOAD_RE.exec(path);
  if (!m) return;

  const folder = m[1].toLowerCase();
  const rest = m[2];
  const file = resolveUploadFile(folder, rest);
  if (!file) return;

  const ext = extname(file).toLowerCase();
  setResponseHeader(event, "Content-Type", MIME[ext] || "application/octet-stream");
  setResponseHeader(event, "Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
  return sendStream(event, createReadStream(file));
});

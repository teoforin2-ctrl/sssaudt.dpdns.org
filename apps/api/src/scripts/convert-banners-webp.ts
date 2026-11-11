/**
 * Convert hero/upload banners (PNG/JPEG/GIF) → WebP (quality 100) and
 * optionally rewrite `banners.image_ru` / `image_en` paths in Postgres.
 *
 * Usage:
 *   pnpm --filter @x-reviewer/api convert:banners
 *   node dist/scripts/convert-banners-webp.js
 *
 * Env:
 *   WEB_PUBLIC_DIR   — web public root (default: apps/web/public)
 *   BANNER_DIRS      — extra dirs to scan, colon-separated
 *   DATABASE_URL     — if set, update banners table paths .png/.jpg → .webp
 *   KEEP_ORIGINALS=1 — keep source PNG/JPEG after conversion (default: delete)
 *   DRY_RUN=1        — report only
 */
import { access, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { toWebpBuffer, withWebpExt, WEBP_QUALITY } from "../images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PUBLIC =
  process.env.WEB_PUBLIC_DIR ||
  path.resolve(__dirname, "../../../web/public");

const EXTRA_DIRS = (process.env.BANNER_DIRS || "")
  .split(":")
  .map((s) => s.trim())
  .filter(Boolean);

const KEEP = process.env.KEEP_ORIGINALS === "1";
const DRY = process.env.DRY_RUN === "1";
const RASTER_RE = /\.(png|jpe?g|gif)$/i;

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function convertFile(src: string) {
  const dest = withWebpExt(src);
  if (dest === src) return null;
  const input = await readFile(src);
  const webp = await toWebpBuffer(input);
  if (!DRY) {
    await writeFile(dest, webp);
    if (!KEEP) await unlink(src).catch(() => undefined);
  }
  return { src, dest, before: input.length, after: webp.length };
}

async function walkDir(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walkDir(full)));
    else if (ent.isFile() && RASTER_RE.test(ent.name)) out.push(full);
  }
  return out;
}

async function updateDbPaths() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skip DB path rewrite");
    return;
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    if (DRY) {
      const { rows } = await pool.query<{ n: string }>(`
        select count(*)::text as n from banners
        where image_ru ~* '\\.(png|jpe?g|gif)$'
           or image_en ~* '\\.(png|jpe?g|gif)$'
      `);
      console.log(`DB would update ${rows[0]?.n || 0} banner row(s)`);
      return;
    }
    const { rowCount } = await pool.query(`
      update banners set
        image_ru = regexp_replace(image_ru, '\\.(png|jpe?g|gif)$', '.webp', 'i'),
        image_en = regexp_replace(image_en, '\\.(png|jpe?g|gif)$', '.webp', 'i'),
        updated_at = now()
      where image_ru ~* '\\.(png|jpe?g|gif)$'
         or image_en ~* '\\.(png|jpe?g|gif)$'
    `);
    console.log(`DB updated ${rowCount ?? 0} banner row(s) → .webp`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const dirs = [
    path.join(ROOT_PUBLIC, "img", "banners"),
    path.join(ROOT_PUBLIC, "uploads", "banners"),
    ...EXTRA_DIRS,
  ];

  console.log(`WebP quality=${WEBP_QUALITY}  public=${ROOT_PUBLIC}  dry=${DRY}  keep=${KEEP}`);
  const files: string[] = [];
  for (const d of dirs) {
    const found = await walkDir(d);
    console.log(`scan ${d}: ${found.length} raster file(s)`);
    files.push(...found);
  }

  let saved = 0;
  for (const f of files) {
    try {
      const res = await convertFile(f);
      if (!res) continue;
      const pct = res.before ? Math.round((1 - res.after / res.before) * 100) : 0;
      console.log(
        `${DRY ? "[dry] " : ""}${path.basename(res.src)} → ${path.basename(res.dest)}  ` +
          `${(res.before / 1024).toFixed(0)}KiB → ${(res.after / 1024).toFixed(0)}KiB (−${pct}%)`,
      );
      saved += 1;
    } catch (err) {
      console.error(`FAIL ${f}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Converted ${saved}/${files.length}`);
  await updateDbPaths();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

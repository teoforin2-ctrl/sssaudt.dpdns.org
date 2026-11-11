/**
 * Resize + convert /img/cats/*.png → WebP at 24 / 48 / 96 px.
 *
 * Output:
 *   apps/web/public/img/cats/24/cat-*.webp
 *   apps/web/public/img/cats/48/cat-*.webp
 *   apps/web/public/img/cats/96/cat-*.webp
 *
 * Env:
 *   KEEP_ORIGINALS=1 — keep source PNGs (default: delete after success)
 *   DRY_RUN=1
 */
import { access, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { WEBP_QUALITY } from "../images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATS_DIR =
  process.env.CATS_DIR ||
  path.resolve(__dirname, "../../../web/public/img/cats");

const SIZES = [24, 48, 96] as const;
const KEEP = process.env.KEEP_ORIGINALS === "1";
const DRY = process.env.DRY_RUN === "1";
const PNG_RE = /^cat-.+\.png$/i;

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(CATS_DIR))) {
    console.error(`Missing ${CATS_DIR}`);
    process.exit(1);
  }

  for (const size of SIZES) {
    await mkdir(path.join(CATS_DIR, String(size)), { recursive: true });
  }

  const entries = await readdir(CATS_DIR);
  const pngs = entries.filter((n) => PNG_RE.test(n));
  console.log(`WebP q=${WEBP_QUALITY}  dir=${CATS_DIR}  sources=${pngs.length}  dry=${DRY}`);

  let ok = 0;
  for (const name of pngs) {
    const src = path.join(CATS_DIR, name);
    const base = name.replace(/\.png$/i, "");
    try {
      const input = sharp(src, { failOn: "none" }).ensureAlpha();
      let totalOut = 0;
      for (const size of SIZES) {
        const dest = path.join(CATS_DIR, String(size), `${base}.webp`);
        const buf = await input
          .clone()
          .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({
            quality: WEBP_QUALITY,
            alphaQuality: WEBP_QUALITY,
            smartSubsample: false,
            effort: 4,
          })
          .toBuffer();
        totalOut += buf.length;
        if (!DRY) await writeFile(dest, buf);
      }
      const meta = await sharp(src).metadata();
      console.log(
        `${DRY ? "[dry] " : ""}${name} (${meta.width}×${meta.height}) → 24/48/96  ` +
          `out≈${(totalOut / 1024).toFixed(1)}KiB`,
      );
      if (!DRY && !KEEP) await unlink(src).catch(() => undefined);
      ok += 1;
    } catch (err) {
      console.error(`FAIL ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Done ${ok}/${pngs.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

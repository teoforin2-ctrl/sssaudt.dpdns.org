/**
 * Convert remaining heavy public assets → WebP + banner -sm variants for srcset.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { WEBP_QUALITY } from "../images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../web/public");

async function convert(
  srcRel: string,
  destRel: string,
  opts: { width?: number; quality?: number } = {},
) {
  const src = path.join(ROOT, srcRel);
  const quality = opts.quality ?? WEBP_QUALITY;
  let pipeline = sharp(src, { failOn: "none" }).ensureAlpha();
  if (opts.width) {
    pipeline = pipeline.resize(opts.width, null, { fit: "inside", withoutEnlargement: true });
  }
  const buf = await pipeline
    .webp({ quality, alphaQuality: quality, smartSubsample: false, effort: 4 })
    .toBuffer();
  const dest = path.join(ROOT, destRel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  const before = (await readFile(src)).length;
  console.log(
    `${srcRel} → ${destRel}  ${(before / 1024).toFixed(0)}→${(buf.length / 1024).toFixed(0)} KiB`,
  );
}

async function main() {
  await convert("img/brand/logo.png", "img/brand/logo.webp", { width: 600 });
  await convert("img/footer_bg.png", "img/footer_bg.webp", { width: 1920, quality: 90 });

  for (const f of await readdir(path.join(ROOT, "img/sections"))) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const base = f.replace(/\.(jpe?g|png)$/i, "");
    await convert(`img/sections/${f}`, `img/sections/${base}.webp`, {
      width: 1600,
      quality: 85,
    });
  }

  for (const f of await readdir(path.join(ROOT, "img/banners"))) {
    if (!f.endsWith(".webp") || f.includes("-sm")) continue;
    const src = path.join(ROOT, "img/banners", f);
    const destName = f.replace(/\.webp$/, "-sm.webp");
    const buf = await sharp(src, { failOn: "none" })
      .resize(960, null, { withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 90, effort: 4 })
      .toBuffer();
    await writeFile(path.join(ROOT, "img/banners", destName), buf);
    console.log(`banner-sm ${f} → ${destName} ${(buf.length / 1024).toFixed(0)} KiB`);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

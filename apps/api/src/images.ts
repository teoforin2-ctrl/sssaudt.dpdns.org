import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Near-original visual quality — no intentional quality drop. */
export const WEBP_QUALITY = 100;

const DATA_URL_RE =
  /^data:(image\/(png|jpeg|jpg|webp|gif|svg\+xml));base64,(.+)$/i;

export type ParsedImageDataUrl = {
  mime: string;
  ext: string;
  buf: Buffer;
};

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl | null {
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return null;
  let ext = m[2].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  if (ext === "svg+xml") ext = "svg";
  const buf = Buffer.from(m[3], "base64");
  if (!buf.length || buf.length > 10_000_000) return null;
  return { mime: m[1].toLowerCase(), ext, buf };
}

/**
 * Convert any sharp-readable raster to WebP without lowering quality (q=100).
 * Animated GIF/WebP: keep animation when possible.
 */
export async function toWebpBuffer(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input, { animated: true, failOn: "none" }).metadata();
  const pages = meta.pages && meta.pages > 1 ? meta.pages : undefined;
  return sharp(input, { animated: Boolean(pages), failOn: "none" })
    .webp({
      quality: WEBP_QUALITY,
      alphaQuality: WEBP_QUALITY,
      smartSubsample: false,
      effort: 4,
      ...(pages ? { loop: meta.loop ?? 0 } : {}),
    })
    .toBuffer();
}

export async function saveRasterAsWebp(opts: {
  dir: string;
  basename: string;
  buf: Buffer;
  publicPathPrefix: string;
}): Promise<string> {
  const webp = await toWebpBuffer(opts.buf);
  await mkdir(opts.dir, { recursive: true });
  const filename = `${opts.basename}.webp`;
  await writeFile(path.join(opts.dir, filename), webp);
  const prefix = opts.publicPathPrefix.replace(/\/$/, "");
  return `${prefix}/${filename}`;
}

/** Replace image extension with .webp in a public URL/path. */
export function withWebpExt(filePath: string): string {
  return filePath.replace(/\.(png|jpe?g|gif|bmp|tiff?)$/i, ".webp");
}

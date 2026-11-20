import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function secretKey(): Buffer {
  const raw =
    process.env.AI_SECRET_KEY ||
    process.env.SESSION_SECRET ||
    process.env.API_SECRET ||
    "x-reviewer-dev-ai-secret-change-me";
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt plaintext API key → base64(iv.tag.ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 28) throw new Error("invalid_secret_blob");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const k = key.trim();
  if (k.length < 8) return "••••";
  return `${k.slice(0, 3)}…${k.slice(-4)}`;
}

export function keyHint(key: string): string {
  const k = key.trim();
  if (k.length < 8) return "••••";
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

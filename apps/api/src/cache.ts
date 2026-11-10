import type { Redis } from "ioredis";

const LIST_TTL_SEC = 60;
const CARD_TTL_SEC = 120;
const VER_KEY = "casinos:cache_ver";

async function cacheVer(redis: Redis): Promise<string> {
  try {
    return (await redis.get(VER_KEY)) || "0";
  } catch {
    return "0";
  }
}

export async function bumpCasinoCache(redis: Redis): Promise<void> {
  try {
    await redis.incr(VER_KEY);
  } catch {
    /* redis down — skip */
  }
}

function listKey(ver: string, locale: string) {
  return `casinos:v${ver}:list:${locale}`;
}

function cardKey(ver: string, slug: string, locale: string) {
  return `casinos:v${ver}:card:${slug}:${locale}`;
}

export async function cacheGetJson<T>(redis: Redis, key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  redis: Redis,
  key: string,
  value: unknown,
  ttlSec: number,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* ignore */
  }
}

export async function getCachedCasinoList<T>(
  redis: Redis,
  locale: string,
): Promise<{ key: string; data: T | null }> {
  const ver = await cacheVer(redis);
  const key = listKey(ver, locale);
  return { key, data: await cacheGetJson<T>(redis, key) };
}

export async function setCachedCasinoList(
  redis: Redis,
  key: string,
  value: unknown,
): Promise<void> {
  await cacheSetJson(redis, key, value, LIST_TTL_SEC);
}

export async function getCachedCasinoCard<T>(
  redis: Redis,
  slug: string,
  locale: string,
): Promise<{ key: string; data: T | null }> {
  const ver = await cacheVer(redis);
  const key = cardKey(ver, slug, locale);
  return { key, data: await cacheGetJson<T>(redis, key) };
}

export async function setCachedCasinoCard(
  redis: Redis,
  key: string,
  value: unknown,
): Promise<void> {
  await cacheSetJson(redis, key, value, CARD_TTL_SEC);
}

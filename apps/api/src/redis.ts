import { Redis } from "ioredis";

export function createRedis() {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6382";
  return new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });
}

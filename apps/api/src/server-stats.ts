import { readFileSync, existsSync, statfsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PROC_ROOT = process.env.HOST_PROC_ROOT || "/proc";

type CpuSample = { idle: number; total: number; at: number };

let lastCpu: CpuSample | null = null;

function readProc(rel: string): string | null {
  const p = path.join(PROC_ROOT, rel);
  try {
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf8");
  }
  catch {
    return null;
  }
}

function sampleCpu(): CpuSample | null {
  const raw = readProc("stat");
  if (!raw) return null;
  const line = raw.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  if (parts.length < 4) return null;
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total, at: Date.now() };
}

function cpuPercent(): number | null {
  const cur = sampleCpu();
  if (!cur) return null;
  const prev = lastCpu;
  lastCpu = cur;
  if (!prev || cur.total <= prev.total) return null;
  const dTotal = cur.total - prev.total;
  const dIdle = cur.idle - prev.idle;
  if (dTotal <= 0) return null;
  return Math.round((1 - dIdle / dTotal) * 1000) / 10;
}

function hostMem() {
  const raw = readProc("meminfo");
  if (!raw) {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      source: "os" as const,
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usedPercent: Math.round((used / total) * 1000) / 10,
    };
  }
  const get = (key: string) => {
    const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return m ? Number(m[1]) * 1024 : 0;
  };
  const total = get("MemTotal");
  const available = get("MemAvailable") || get("MemFree");
  const used = Math.max(0, total - available);
  return {
    source: "host_proc" as const,
    totalBytes: total,
    freeBytes: available,
    usedBytes: used,
    usedPercent: total ? Math.round((used / total) * 1000) / 10 : 0,
  };
}

function hostUptimeSec(): number {
  const raw = readProc("uptime");
  if (raw) {
    const n = Number(raw.trim().split(/\s+/)[0]);
    if (Number.isFinite(n)) return n;
  }
  return os.uptime();
}

function diskRoot() {
  try {
    const s = statfsSync("/");
    const total = Number(s.blocks) * Number(s.bsize);
    const free = Number(s.bavail) * Number(s.bsize);
    const used = total - free;
    return {
      path: "/",
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usedPercent: total ? Math.round((used / total) * 1000) / 10 : 0,
    };
  }
  catch {
    return null;
  }
}

export function collectServerStats() {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  return {
    ok: true as const,
    ts: new Date().toISOString(),
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptimeSec: hostUptimeSec(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || null,
      cpuPercent: cpuPercent(),
      loadAvg: {
        m1: Math.round(load[0]! * 100) / 100,
        m5: Math.round(load[1]! * 100) / 100,
        m15: Math.round(load[2]! * 100) / 100,
      },
      memory: hostMem(),
      disk: diskRoot(),
    },
    process: {
      pid: process.pid,
      uptimeSec: process.uptime(),
      node: process.version,
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
    },
  };
}

export type ServerStats = ReturnType<typeof collectServerStats>;

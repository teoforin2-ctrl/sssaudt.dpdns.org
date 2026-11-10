import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statfsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Host /proc when API runs in Docker (see HOST_PROC_ROOT in compose). */
const PROC_ROOT = process.env.HOST_PROC_ROOT || "/proc";
/** Host root filesystem for disk (compose: /:/host/root:ro). */
const HOST_ROOT = process.env.HOST_ROOT || "/";

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

function loadAvgPercent(): number {
  const n = Math.max(1, os.cpus().length);
  const load = os.loadavg()[0] || 0;
  return Math.round(Math.min(100, (load / n) * 1000) / 10);
}

function cpuPercent(): number {
  const cur = sampleCpu();
  if (!cur) return loadAvgPercent();

  const prev = lastCpu;
  lastCpu = cur;
  if (!prev || cur.total <= prev.total) return loadAvgPercent();

  const dTotal = cur.total - prev.total;
  const dIdle = cur.idle - prev.idle;
  if (dTotal <= 0) return loadAvgPercent();
  return Math.round((1 - dIdle / dTotal) * 1000) / 10;
}

function hostMemLinux() {
  const raw = readProc("meminfo");
  if (!raw) return null;
  const get = (key: string) => {
    const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return m ? Number(m[1]) * 1024 : 0;
  };
  const total = get("MemTotal");
  // Match htop-ish "used": total - free - buffers - cached (+ reclaimable SReclaimable)
  const free = get("MemFree");
  const buffers = get("Buffers");
  const cached = get("Cached");
  const sreclaim = get("SReclaimable");
  const available = get("MemAvailable") || free + buffers + cached;
  // Application-ish used (closer to htop green/red bar, not cache)
  const usedApps = Math.max(0, total - free - buffers - cached - sreclaim);
  return {
    source: "host_proc" as const,
    totalBytes: total,
    freeBytes: available,
    usedBytes: usedApps,
    usedPercent: total ? Math.round((usedApps / total) * 1000) / 10 : 0,
    availableBytes: available,
  };
}

/** macOS: os.freemem() is nearly useless (excludes reclaimable). Use vm_stat. */
function hostMemDarwin() {
  const total = os.totalmem();
  try {
    const out = execFileSync("/usr/bin/vm_stat", { encoding: "utf8" });
    const pageSizeMatch = out.match(/page size of (\d+) bytes/i);
    const pageSize = pageSizeMatch ? Number(pageSizeMatch[1]) : 16384;
    const pages = (label: string) => {
      const m = out.match(new RegExp(`${label}:\\s+([0-9]+)\\.`, "i"));
      return m ? Number(m[1]) * pageSize : 0;
    };
    const free = pages("Pages free") + pages("Pages speculative");
    const active = pages("Pages active");
    const wired = pages("Pages wired down") || pages("Pages wired");
    const compressed = pages("Pages occupied by compressor");
    const used = active + wired + compressed;
    const available = Math.max(0, total - used);
    return {
      source: "vm_stat" as const,
      totalBytes: total,
      freeBytes: Math.max(free, available),
      usedBytes: used,
      usedPercent: total ? Math.round((used / total) * 1000) / 10 : 0,
      availableBytes: available,
    };
  }
  catch {
    const free = os.freemem();
    const used = total - free;
    return {
      source: "os" as const,
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usedPercent: Math.round((used / total) * 1000) / 10,
      availableBytes: free,
    };
  }
}

function hostMem() {
  return hostMemLinux() || (os.platform() === "darwin" ? hostMemDarwin() : (() => {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      source: "os" as const,
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usedPercent: Math.round((used / total) * 1000) / 10,
      availableBytes: free,
    };
  })());
}

function hostUptimeSec(): number {
  const raw = readProc("uptime");
  if (raw) {
    const n = Number(raw.trim().split(/\s+/)[0]);
    if (Number.isFinite(n)) return n;
  }
  return os.uptime();
}

function hostHostname(): string {
  const fromProc = readProc("sys/kernel/hostname");
  if (fromProc) {
    const h = fromProc.trim();
    if (h) return h;
  }
  return os.hostname();
}

function hostCpuCount(): number {
  const raw = readProc("cpuinfo");
  if (raw) {
    const n = (raw.match(/^processor\s*:/gm) || []).length;
    if (n > 0) return n;
  }
  return os.cpus().length;
}

function hostLoadAvg(): { m1: number; m5: number; m15: number } {
  const raw = readProc("loadavg");
  if (raw) {
    const [a, b, c] = raw.trim().split(/\s+/).map(Number);
    if ([a, b, c].every((x) => Number.isFinite(x))) {
      return {
        m1: Math.round(a! * 100) / 100,
        m5: Math.round(b! * 100) / 100,
        m15: Math.round(c! * 100) / 100,
      };
    }
  }
  const load = os.loadavg();
  return {
    m1: Math.round(load[0]! * 100) / 100,
    m5: Math.round(load[1]! * 100) / 100,
    m15: Math.round(load[2]! * 100) / 100,
  };
}

function diskRoot() {
  const targets = [HOST_ROOT, "/"].filter((v, i, a) => a.indexOf(v) === i);
  for (const root of targets) {
    try {
      if (!existsSync(root)) continue;
      const s = statfsSync(root);
      const total = Number(s.blocks) * Number(s.bsize);
      const free = Number(s.bavail) * Number(s.bsize);
      const used = total - free;
      if (!total) continue;
      return {
        path: root,
        totalBytes: total,
        freeBytes: free,
        usedBytes: used,
        usedPercent: Math.round((used / total) * 1000) / 10,
      };
    }
    catch {
      /* try next */
    }
  }
  return null;
}

export function collectServerStats() {
  // Prime CPU sample so the next poll (and a short wait below) can compute a delta.
  if (!lastCpu) sampleCpu();

  const mem = process.memoryUsage();
  const load = hostLoadAvg();
  const cpuCount = hostCpuCount();

  return {
    ok: true as const,
    ts: new Date().toISOString(),
    host: {
      hostname: hostHostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptimeSec: hostUptimeSec(),
      cpuCount,
      cpuModel: os.cpus()[0]?.model || null,
      cpuPercent: cpuPercent(),
      loadAvg: load,
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

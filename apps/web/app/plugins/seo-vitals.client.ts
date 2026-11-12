type VitalPayload = {
  path: string;
  locale: "ru" | "en";
  lcp?: number | null;
  inp?: number | null;
  cls?: number | null;
  ttfb?: number | null;
  navType?: string | null;
};

function localeFromPath(path: string): "ru" | "en" {
  return path === "/en" || path.startsWith("/en/") ? "en" : "ru";
}

function observe(type: string, cb: (entries: PerformanceEntryList) => void) {
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()));
    po.observe({ type, buffered: true } as PerformanceObserverInit);
    return po;
  } catch {
    return null;
  }
}

export default defineNuxtPlugin(() => {
  if (import.meta.server) return;
  const ua = navigator.userAgent || "";
  if (/bot|crawler|spider|slurp/i.test(ua)) return;

  const config = useRuntimeConfig();
  const payload: VitalPayload = {
    path: "/",
    locale: "ru",
  };
  let sent = false;

  function flush() {
    if (sent) return;
    sent = true;
    const path = window.location.pathname.slice(0, 500) || "/";
    payload.path = path;
    payload.locale = localeFromPath(path);
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      payload.ttfb = Math.round(nav.responseStart);
      payload.navType = nav.type;
    }
    const body: Record<string, unknown> = {
      path: payload.path,
      locale: payload.locale,
      lcp: payload.lcp ?? null,
      inp: payload.inp ?? null,
      cls: payload.cls ?? null,
      ttfb: payload.ttfb ?? null,
      navType: payload.navType ?? null,
    };
    const url = `${String(config.public.apiBase).replace(/\/$/, "")}/v1/seo/vitals`;
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      mode: "cors",
    }).catch(() => undefined);
  }

  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1] as PerformanceEntry & { startTime?: number };
    if (last?.startTime != null) payload.lcp = last.startTime;
  });

  observe("layout-shift", (entries) => {
    let cls = payload.cls || 0;
    for (const entry of entries) {
      const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!e.hadRecentInput) cls += e.value || 0;
    }
    payload.cls = cls;
  });

  observe("event", (entries) => {
    for (const entry of entries) {
      const e = entry as PerformanceEntry & { duration?: number; name?: string };
      if (e.name === "first-input" || e.duration != null) {
        payload.inp = Math.max(payload.inp || 0, e.duration || 0);
      }
    }
  });

  observe("first-input", (entries) => {
    const first = entries[0] as PerformanceEntry & { processingStart?: number; startTime?: number };
    if (first?.processingStart != null && first.startTime != null) {
      payload.inp = Math.max(payload.inp || 0, first.processingStart - first.startTime);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
  setTimeout(flush, 12000);
});

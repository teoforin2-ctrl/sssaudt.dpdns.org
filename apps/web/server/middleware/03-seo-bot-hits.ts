const BOT_RE = /googlebot|google-inspectiontool|adsbot-google|yandex(bot|images|media)|bingbot|msnbot|bot|crawler|spider|slurp/i;

export default defineEventHandler((event) => {
  const path = event.path || "";
  if (path.startsWith("/_nuxt") || path.startsWith("/v1/") || path.startsWith("/health")) return;
  const ua = getHeader(event, "user-agent") || "";
  if (!BOT_RE.test(ua)) return;
  const config = useRuntimeConfig();
  const base = String(config.public.apiBase || "").replace(/\/$/, "");
  if (!base) return;
  void $fetch(`${base}/v1/seo/bot-hit`, {
    method: "POST",
    body: { ua: ua.slice(0, 400) },
  }).catch(() => undefined);
});

/**
 * Proxy robots.txt + sitemap to the API so local/dev and non-Caddy frontends
 * still serve live SEO files (Caddy does the same in production).
 */
import { getRequestHeader, getRequestURL, proxyRequest } from "h3";

const SEO_FILE_RE = /^\/(robots\.txt|sitemap\.xml|sitemaps\/.+)$/i;

export default defineEventHandler(async (event) => {
  const path = event.path?.split("?")[0] || "";
  if (!SEO_FILE_RE.test(path)) return;

  const config = useRuntimeConfig();
  const apiBase = String(config.public.apiBase || "http://127.0.0.1:3712").replace(/\/$/, "");
  const target = `${apiBase}${path}${getRequestURL(event).search || ""}`;
  const host = getRequestHeader(event, "host") || "127.0.0.1:3710";
  const proto = getRequestURL(event).protocol.replace(":", "") || "http";

  return proxyRequest(event, target, {
    headers: {
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
    },
  });
});

import { createHash } from "node:crypto";

/**
 * Weak ETag for SSR HTML responses so CDNs/browsers can revalidate cheaply (T12).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:response", (response, { event }) => {
    if (!response || typeof response.body !== "string") return;
    const ct = String(response.headers?.["content-type"] || event.node.res.getHeader("content-type") || "");
    if (ct && !ct.includes("text/html")) return;

    const hash = createHash("sha1").update(response.body).digest("hex").slice(0, 20);
    const etag = `W/"${hash}"`;
    response.headers = {
      ...(response.headers || {}),
      etag,
      "cache-control":
        response.headers?.["cache-control"]
        || "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    };

    const inm = event.node.req.headers["if-none-match"];
    if (inm && String(inm) === etag) {
      response.statusCode = 304;
      response.body = "";
    }
  });
});

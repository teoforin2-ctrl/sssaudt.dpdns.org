/**
 * Staging / indexing-off safety: X-Robots-Tag on every response.
 * Production with admin indexing enabled → no header (meta handles index,follow).
 *
 * Note: full DB-backed toggle is applied in HTML meta via useIndexing().
 * This middleware enforces env staging lock and optional hard env off.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const env = String(config.public.env || process.env.NUXT_PUBLIC_ENV || "").toLowerCase();
  const isStaging = env === "staging" || env === "dev" || env === "development";
  if (isStaging) {
    setHeader(event, "X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
});

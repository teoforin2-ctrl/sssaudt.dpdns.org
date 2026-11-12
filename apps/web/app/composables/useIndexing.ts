/**
 * Effective search-indexing flag.
 * - Staging / non-production env → always false (safety lock)
 * - Production → admin SEO toggle (seo.indexingEnabled), with env allowIndexing as optional AND gate
 */
export function useIndexing() {
  const config = useRuntimeConfig();
  const { settings } = useSiteSettings();

  const isProduction = computed(() => {
    const env = String(config.public.env || "").toLowerCase();
    if (env === "staging" || env === "dev" || env === "development") return false;
    if (env === "production" || env === "prod") return true;
    // Fallback: treat known prod site URL as production
    const site = String(config.public.siteUrl || "");
    return /dfijdsif\.website/i.test(site);
  });

  const indexingEnabled = computed(() => {
    if (!isProduction.value) return false;
    const fromAdmin = settings.value.seo?.indexingEnabled === true;
    // If env explicitly false and set, keep as hard off until ops removes it —
    // but prefer admin once they turn indexing on (admin wins when true).
    const envRaw = String(config.public.allowIndexing ?? "").toLowerCase();
    if (fromAdmin) return true;
    return envRaw === "true";
  });

  const robotsContent = computed(() =>
    indexingEnabled.value
      ? "index, follow"
      : "noindex, nofollow, noarchive, nosnippet",
  );

  return { indexingEnabled, robotsContent, isProduction };
}

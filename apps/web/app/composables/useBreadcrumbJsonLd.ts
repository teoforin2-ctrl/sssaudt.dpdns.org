export type BreadcrumbItem = {
  name: string;
  /** Locale-aware path, e.g. /rating or /casino/foo */
  path?: string;
};

/** Emit BreadcrumbList JSON-LD matching visible crumbs. */
export function useBreadcrumbJsonLd(
  items: MaybeRefOrGetter<BreadcrumbItem[]>,
) {
  const config = useRuntimeConfig();
  const { settings } = useSiteSettings();
  const { locale } = useI18n();

  useJsonLd(() => {
    const list = toValue(items).filter((i) => i?.name);
    if (list.length < 2) return null;

    const host = String(
      settings.value.seo?.canonicalHost
        || config.public.siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")
        || "dfijdsif.website",
    );
    const loc = (locale.value === "en" ? "en" : "ru") as "ru" | "en";

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: list.map((item, i) => {
        const entry: Record<string, unknown> = {
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
        };
        if (item.path) {
          entry.item = buildCanonical(item.path, loc, host);
        }
        return entry;
      }),
    };
  });
}

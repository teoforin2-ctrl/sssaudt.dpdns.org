type SeoInput = {
  title: MaybeRefOrGetter<string>;
  description?: MaybeRefOrGetter<string | null | undefined>;
  /** Force noindex even when indexing is enabled globally */
  noindex?: MaybeRefOrGetter<boolean>;
  /** Path for canonical (defaults to current route) */
  path?: MaybeRefOrGetter<string | null | undefined>;
  ogImage?: MaybeRefOrGetter<string | null | undefined>;
  ogType?: MaybeRefOrGetter<"website" | "article" | "profile" | undefined>;
};

/**
 * Page title/description/robots/canonical/OG basics.
 * Site name + indexing come from admin site-settings / SEO.
 */
export function usePageSeo(input: SeoInput) {
  const config = useRuntimeConfig();
  const { locale } = useI18n();
  const { siteName, settings } = useSiteSettings();
  const { indexingEnabled } = useIndexing();
  const route = useRoute();

  useHead(() => {
    const name = String(siteName.value || config.public.siteName || "SS Audit").trim();
    const title = String(toValue(input.title) || "").trim();
    const description = String(toValue(input.description) || "").trim() || undefined;
    const forceNoindex = toValue(input.noindex) === true;
    const allow = indexingEnabled.value && !forceNoindex;
    const robots = allow
      ? "index, follow"
      : "noindex, nofollow, noarchive, nosnippet";

    const loc = (locale.value === "en" ? "en" : "ru") as "ru" | "en";
    const pathArg = toValue(input.path);
    const host = String(
      settings.value.seo?.canonicalHost
        || config.public.siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")
        || "dfijdsif.website",
    );
    const canonical = buildCanonical(
      pathArg != null && String(pathArg).trim() ? String(pathArg) : route.path,
      loc,
      host,
    );

    const ogImageRaw =
      toValue(input.ogImage)
      || settings.value.seo?.defaultOgImage
      || "/img/brand/logo.webp";
    const ogImage = ogImageRaw.startsWith("http")
      ? ogImageRaw
      : `${String(config.public.siteUrl || "").replace(/\/$/, "")}${ogImageRaw.startsWith("/") ? "" : "/"}${ogImageRaw}`;

    const ogType = toValue(input.ogType) || "website";
    // Generated / default OG cards are always 1200×630; entity logos may differ but
    // platforms still benefit from explicit dimensions on the card URL.
    const ogIsCard
      = !toValue(input.ogImage)
      || ogImage.includes("/v1/og/")
      || ogImage.includes("/uploads/og/")
      || ogImage.includes("/uploads/brand/og-");

    return {
      title: title || name,
      titleTemplate: (chunk?: string) => {
        const t = String(chunk || "").trim();
        if (!t || t === name) return name;
        if (t.includes(name)) return t;
        return `${t} — ${name}`;
      },
      link: [{ key: "canonical", rel: "canonical", href: canonical }],
      meta: [
        { name: "robots", content: robots },
        { name: "googlebot", content: robots },
        { property: "og:site_name", content: name },
        { name: "application-name", content: name },
        { property: "og:type", content: ogType },
        { property: "og:url", content: canonical },
        { property: "og:locale", content: loc === "en" ? "en_US" : "ru_RU" },
        { property: "og:image", content: ogImage },
        ...(ogIsCard
          ? [
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: ogImage },
        ...(description
          ? [
              { name: "description", content: description },
              { property: "og:description", content: description },
              { name: "twitter:description", content: description },
            ]
          : []),
        ...(title
          ? [
              {
                property: "og:title",
                content: title.includes(name) ? title : `${title} — ${name}`,
              },
              {
                name: "twitter:title",
                content: title.includes(name) ? title : `${title} — ${name}`,
              },
            ]
          : []),
      ],
    };
  });
}

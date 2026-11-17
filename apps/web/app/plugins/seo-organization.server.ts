/**
 * Sitewide Organization + WebSite JSON-LD (T9 baseline).
 * Page-specific Review/Article schemas stay on entity pages.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const { siteName, settings, logoUrl } = useSiteSettings();
  const localePath = useLocalePath();

  useJsonLd(() => {
    const name = String(siteName.value || config.public.siteName || "SSS Audit").trim();
    const host = String(
      settings.value.seo?.canonicalHost
        || config.public.siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")
        || "dfijdsif.website",
    );
    const origin = `https://${host}`;
    const sameAs = (settings.value.seo?.organizationSameAs || []).filter(Boolean);
    const logo = logoUrl.value
      ? (logoUrl.value.startsWith("http")
          ? logoUrl.value
          : `${String(config.public.siteUrl || origin).replace(/\/$/, "")}${logoUrl.value}`)
      : undefined;

    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name,
        url: origin,
        ...(logo ? { logo } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name,
        url: origin,
        inLanguage: ["ru", "en"],
        potentialAction: {
          "@type": "SearchAction",
          target: `${String(config.public.siteUrl || origin).replace(/\/$/, "")}${localePath("/search")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ];
  });
});

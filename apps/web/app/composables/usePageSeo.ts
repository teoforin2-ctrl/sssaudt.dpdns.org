type SeoInput = {
  title: MaybeRefOrGetter<string>;
  description?: MaybeRefOrGetter<string | null | undefined>;
  /** Force noindex even when NUXT_PUBLIC_ALLOW_INDEXING=true */
  noindex?: MaybeRefOrGetter<boolean>;
};

/**
 * Page title/description + robots.
 * Staging default: noindex (allowIndexing=false).
 * Prod: set NUXT_PUBLIC_ALLOW_INDEXING=true; pass noindex for junk URLs.
 * Site name comes from admin site-settings (not build-time runtimeConfig).
 */
export function usePageSeo(input: SeoInput) {
  const config = useRuntimeConfig();
  const { siteName } = useSiteSettings();
  const allowIndexing = computed(
    () => String(config.public.allowIndexing ?? "").toLowerCase() === "true",
  );

  useHead(() => {
    const name = String(siteName.value || config.public.siteName || "SS Audit").trim();
    const title = String(toValue(input.title) || "").trim();
    const description = String(toValue(input.description) || "").trim() || undefined;
    const forceNoindex = toValue(input.noindex) === true;
    const robots =
      !allowIndexing.value || forceNoindex
        ? "noindex, nofollow, noarchive, nosnippet"
        : "index, follow";

    return {
      title: title || name,
      titleTemplate: (chunk?: string) => {
        const t = String(chunk || "").trim();
        if (!t || t === name) return name;
        if (t.includes(name)) return t;
        return `${t} — ${name}`;
      },
      meta: [
        { name: "robots", content: robots },
        { name: "googlebot", content: robots },
        { property: "og:site_name", content: name },
        { name: "application-name", content: name },
        ...(description
          ? [
              { name: "description", content: description },
              { property: "og:description", content: description },
            ]
          : []),
        ...(title
          ? [
              { property: "og:title", content: title.includes(name) ? title : `${title} — ${name}` },
            ]
          : []),
      ],
    };
  });
}

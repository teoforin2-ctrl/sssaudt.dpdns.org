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
 */
export function usePageSeo(input: SeoInput) {
  const config = useRuntimeConfig();
  const siteName = computed(() => String(config.public.siteName || "SS Audit"));
  const allowIndexing = computed(
    () => String(config.public.allowIndexing ?? "").toLowerCase() === "true",
  );

  useHead(() => {
    const title = String(toValue(input.title) || "").trim();
    const description = String(toValue(input.description) || "").trim() || undefined;
    const forceNoindex = toValue(input.noindex) === true;
    const robots =
      !allowIndexing.value || forceNoindex
        ? "noindex, nofollow, noarchive, nosnippet"
        : "index, follow";

    return {
      title: title || siteName.value,
      titleTemplate: (chunk?: string) => {
        const t = String(chunk || "").trim();
        if (!t || t === siteName.value) return siteName.value;
        if (t.includes(siteName.value)) return t;
        return `${t} — ${siteName.value}`;
      },
      meta: [
        { name: "robots", content: robots },
        { name: "googlebot", content: robots },
        ...(description
          ? [
              { name: "description", content: description },
              { property: "og:description", content: description },
            ]
          : []),
        ...(title ? [{ property: "og:title", content: title }] : []),
      ],
    };
  });
}

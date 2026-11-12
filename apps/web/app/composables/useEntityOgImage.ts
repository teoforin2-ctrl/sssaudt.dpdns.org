/**
 * Resolve og:image for entity pages:
 * 1) explicit seo.ogImage
 * 2) cover/logo
 * 3) generated API card /v1/og/:kind/:slug
 */
export function useEntityOgImage(
  kind: MaybeRefOrGetter<"casino" | "slot" | "article">,
  slug: MaybeRefOrGetter<string | null | undefined>,
  opts: {
    seoOg?: MaybeRefOrGetter<string | null | undefined>;
    fallbackImage?: MaybeRefOrGetter<string | null | undefined>;
  } = {},
) {
  const config = useRuntimeConfig();
  const { locale } = useI18n();

  return computed(() => {
    const custom = String(toValue(opts.seoOg) || "").trim();
    if (custom) return custom;
    const cover = String(toValue(opts.fallbackImage) || "").trim();
    if (cover) return cover;
    const s = String(toValue(slug) || "").trim();
    if (!s) return null;
    const api = String(config.public.apiBase || "").replace(/\/$/, "");
    const loc = locale.value === "en" ? "en" : "ru";
    return `${api}/v1/og/${toValue(kind)}/${encodeURIComponent(s)}?locale=${loc}`;
  });
}

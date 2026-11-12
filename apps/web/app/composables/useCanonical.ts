/** Query keys stripped from canonical (tracking / UI state — never index variants). */
export const CANONICAL_STRIP_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "yclid",
  "fbclid",
  "ref",
  "sort",
  "page",
  "q",
] as const;

/** Pure helper — no Nuxt composables inside (safe from useHead callbacks). */
export function buildCanonical(
  path: string,
  locale: "ru" | "en" = "ru",
  host = "dfijdsif.website",
): string {
  const cleanHost = String(host || "dfijdsif.website")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  let clean = String(path || "/");
  // Always drop query + hash — param matrix lives on self-canonical clean URLs
  clean = (clean.split("?")[0] ?? clean).split("#")[0] ?? clean;
  clean = clean.replace(/\/{2,}/g, "/");
  clean = clean.replace(/\/+$/, "") || "/";
  clean = clean.replace(/^\/(ru|en)(?=\/|$)/, "") || "/";

  if (locale === "ru") {
    if (clean === "/") return `https://${cleanHost}/`;
    return `https://${cleanHost}/ru${clean}`;
  }
  if (clean === "/") return `https://${cleanHost}/en`;
  return `https://${cleanHost}/en${clean}`;
}

export function useCanonical(path?: MaybeRefOrGetter<string>) {
  const config = useRuntimeConfig();
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const route = useRoute();

  const host = computed(() =>
    String(
      settings.value.seo?.canonicalHost
        || config.public.siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")
        || "dfijdsif.website",
    ),
  );

  const href = computed(() => {
    const loc = (locale.value === "en" ? "en" : "ru") as "ru" | "en";
    const p = path !== undefined ? String(toValue(path) || "/") : route.path;
    return buildCanonical(p, loc, host.value);
  });

  useHead(() => ({
    link: [{ key: "canonical", rel: "canonical", href: href.value }],
  }));

  return { href, buildCanonical, host };
}

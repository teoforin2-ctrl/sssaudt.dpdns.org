export type SeoTemplateKind =
  | "home"
  | "catalog"
  | "casino"
  | "slot"
  | "bonuses"
  | "article"
  | "forum";

export type SeoLocaleFields = {
  title?: string;
  description?: string;
  h1?: string;
};

export type SeoTemplateI18n = {
  ru?: SeoLocaleFields;
  en?: SeoLocaleFields;
  // legacy flat fields (treated as RU)
  title?: string;
  description?: string;
  h1?: string;
};

export type SeoTemplateVars = Record<string, string | number | null | undefined>;

function applyVars(raw: string | undefined, vars: SeoTemplateVars): string {
  const src = String(raw || "").trim();
  if (!src) return "";
  return src.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null || v === "" ? `{${key}}` : String(v);
  });
}

function localeFields(tpl: SeoTemplateI18n | undefined, loc: "ru" | "en"): SeoLocaleFields {
  if (!tpl) return {};
  if (tpl.ru || tpl.en) {
    const primary = loc === "en" ? tpl.en : tpl.ru;
    const fallback = loc === "en" ? tpl.ru : tpl.en;
    return { ...(fallback || {}), ...(primary || {}) };
  }
  // Legacy flat = RU only
  if (loc === "ru") {
    return {
      title: tpl.title,
      description: tpl.description,
      h1: tpl.h1,
    };
  }
  return {};
}

/**
 * Resolve Admin→SEO templates for a page type + current locale (ru/en).
 * Empty template fields fall back to the provided i18n/default strings.
 */
export function useSeoTemplate(
  kind: MaybeRefOrGetter<SeoTemplateKind>,
  vars: MaybeRefOrGetter<SeoTemplateVars> = {},
) {
  const { seo, siteName } = useSiteSettings();
  const { locale } = useI18n();

  const resolved = computed(() => {
    const key = toValue(kind);
    const loc = (locale.value === "en" ? "en" : "ru") as "ru" | "en";
    const raw = seo.value?.templates?.[key] as SeoTemplateI18n | undefined;
    const tpl = localeFields(raw, loc);
    const mergedVars: SeoTemplateVars = {
      siteName: siteName.value,
      ...toValue(vars),
    };
    return {
      title: applyVars(tpl.title, mergedVars),
      description: applyVars(tpl.description, mergedVars),
      h1: applyVars(tpl.h1, mergedVars),
      locale: loc,
    };
  });

  function pick(field: "title" | "description" | "h1", fallback: string) {
    const v = resolved.value[field];
    return v || fallback;
  }

  /**
   * Entity override → template → i18n/fallback.
   * Pass locale-resolved entity seo fields from the API.
   */
  function pickEntity(
    field: "title" | "description" | "h1",
    entity: MaybeRefOrGetter<{ title?: string | null; description?: string | null; h1?: string | null } | null | undefined>,
    fallback: string,
  ) {
    const e = toValue(entity);
    const override = String(e?.[field] || "").trim();
    if (override) return override;
    return pick(field, fallback);
  }

  return { template: resolved, pick, pickEntity };
}

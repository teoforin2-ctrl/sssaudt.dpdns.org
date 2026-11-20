/** Public article category kinds (stored in articles.kind). */
export const ARTICLE_KINDS = [
  {
    id: "slot-cards",
    slug: "slot-cards",
    labelRu: "Карточки слотов",
    labelEn: "Slot cards",
  },
  {
    id: "providers",
    slug: "providers",
    labelRu: "Провайдеры",
    labelEn: "Providers",
  },
  {
    id: "glossary",
    slug: "glossary",
    labelRu: "Справочник и глоссарий",
    labelEn: "Reference & glossary",
  },
  {
    id: "mechanics-guides",
    slug: "mechanics-guides",
    labelRu: "Гайды по механикам",
    labelEn: "Mechanics guides",
  },
  {
    id: "news",
    slug: "news",
    labelRu: "Новости",
    labelEn: "News",
  },
  {
    id: "collections",
    slug: "collections",
    labelRu: "Подборки",
    labelEn: "Collections",
  },
] as const;

export type ArticleKindId = (typeof ARTICLE_KINDS)[number]["id"];

/** Older kinds still present in DB — keep editable in admin. */
export const LEGACY_ARTICLE_KINDS = [
  { id: "guide", labelRu: "Обзоры и гайды (legacy)", labelEn: "Guides (legacy)" },
  { id: "analytics", labelRu: "Аналитика (legacy)", labelEn: "Analytics (legacy)" },
] as const;

export const ALL_ARTICLE_KIND_OPTIONS = [...ARTICLE_KINDS, ...LEGACY_ARTICLE_KINDS] as const;

export function articleKindLabel(kind: string | null | undefined, locale: "ru" | "en" = "ru"): string | null {
  if (!kind) return null;
  const id = kind.trim().toLowerCase();
  for (const k of ALL_ARTICLE_KIND_OPTIONS) {
    if (k.id === id) return locale === "en" ? k.labelEn : k.labelRu;
  }
  return kind;
}

export function isArticleKindId(value: string): value is ArticleKindId {
  return ARTICLE_KINDS.some((k) => k.id === value);
}

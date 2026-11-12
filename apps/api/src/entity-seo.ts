import { z } from "zod";

const localeFieldsSchema = z
  .object({
    title: z.string().max(200).optional(),
    description: z.string().max(400).optional(),
    h1: z.string().max(200).optional(),
  })
  .passthrough();

/** Accepts {ru,en,ogImage} or legacy flat fields (= RU). */
export const entitySeoSchema = z
  .object({
    ru: localeFieldsSchema.optional(),
    en: localeFieldsSchema.optional(),
    ogImage: z.string().max(500).nullable().optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(400).optional(),
    h1: z.string().max(200).optional(),
  })
  .passthrough();

export type EntitySeoLocale = {
  title?: string;
  description?: string;
  h1?: string;
};

export type EntitySeo = {
  ru: EntitySeoLocale;
  en: EntitySeoLocale;
  ogImage: string | null;
};

function clean(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function asLocale(v: unknown): EntitySeoLocale {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: EntitySeoLocale = {};
  const title = clean(o.title);
  const description = clean(o.description);
  const h1 = clean(o.h1);
  if (title !== undefined) out.title = title;
  if (description !== undefined) out.description = description;
  if (h1 !== undefined) out.h1 = h1;
  return out;
}

export function normalizeEntitySeo(raw: unknown): EntitySeo {
  if (!raw || typeof raw !== "object") {
    return { ru: {}, en: {}, ogImage: null };
  }
  const o = raw as Record<string, unknown>;
  if ("ru" in o || "en" in o || "ogImage" in o) {
    return {
      ru: asLocale(o.ru),
      en: asLocale(o.en),
      ogImage: clean(o.ogImage) ?? null,
    };
  }
  return {
    ru: asLocale(o),
    en: {},
    ogImage: null,
  };
}

export function pickEntitySeo(
  raw: unknown,
  lang: "ru" | "en",
): EntitySeoLocale & { ogImage: string | null } {
  const seo = normalizeEntitySeo(raw);
  const primary = lang === "en" ? seo.en : seo.ru;
  const fallback = lang === "en" ? seo.ru : seo.en;
  return {
    ...fallback,
    ...primary,
    ogImage: seo.ogImage,
  };
}

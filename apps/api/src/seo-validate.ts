import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireStaff } from "./auth.js";
import { normalizeEntitySeo, type EntitySeo } from "./entity-seo.js";
import { loadSeo } from "./seo.js";

export type SeoIssue = {
  level: "error" | "warning";
  code: string;
  locale?: "ru" | "en";
  message: string;
};

export type SeoValidateResult = {
  ok: boolean;
  blockers: SeoIssue[];
  warnings: SeoIssue[];
  resolved: {
    ru: { title: string; description: string };
    en: { title: string; description: string };
  };
};

export type EntityKind = "casino" | "slot" | "article";

type Draft = {
  kind: EntityKind;
  id?: string | null;
  slug?: string | null;
  status?: string | null;
  name?: string | null;
  name_ru?: string | null;
  name_en?: string | null;
  title?: string | null;
  title_ru?: string | null;
  title_en?: string | null;
  short_desc_ru?: string | null;
  short_desc_en?: string | null;
  excerpt_ru?: string | null;
  excerpt_en?: string | null;
  description_ru?: string | null;
  description_en?: string | null;
  seo?: unknown;
};

function applyVars(raw: string, vars: Record<string, string>): string {
  return raw.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function displayName(d: Draft, loc: "ru" | "en"): string {
  if (d.kind === "article") {
    return String((loc === "en" ? d.title_en : d.title_ru) || d.title || "").trim();
  }
  if (d.kind === "slot") return String(d.title || "").trim();
  return String((loc === "en" ? d.name_en : d.name_ru) || d.name || "").trim();
}

function bodyDesc(d: Draft, loc: "ru" | "en"): string {
  if (d.kind === "article") {
    return String((loc === "en" ? d.excerpt_en : d.excerpt_ru) || "").trim();
  }
  if (d.kind === "slot") {
    return String((loc === "en" ? d.description_en : d.description_ru) || "").trim();
  }
  return String((loc === "en" ? d.short_desc_en : d.short_desc_ru) || "").trim();
}

function buildJsonLd(kind: EntityKind, name: string, description: string): Record<string, unknown> {
  if (kind === "article") {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: name,
      description: description || undefined,
    };
  }
  if (kind === "slot") {
    return {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name,
      description: description || undefined,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: { "@type": "Organization", name },
    author: { "@type": "Organization", name: "SSS Audit" },
    description: description || undefined,
  };
}

function jsonLdIssues(kind: EntityKind, name: string, description: string): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const payload = buildJsonLd(kind, name, description);
  try {
    const parsed = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    if (!parsed["@type"]) {
      issues.push({
        level: "error",
        code: "jsonld_type",
        message: "JSON-LD без @type",
      });
    }
    if (kind === "article") {
      if (parsed.headline !== name) {
        issues.push({
          level: "error",
          code: "jsonld_drift",
          message: "JSON-LD headline не совпадает с названием статьи",
        });
      }
    } else if (kind === "slot") {
      if (parsed.name !== name) {
        issues.push({
          level: "error",
          code: "jsonld_drift",
          message: "JSON-LD name не совпадает с названием слота",
        });
      }
    } else {
      const reviewed = parsed.itemReviewed as { name?: string } | undefined;
      if (reviewed?.name !== name) {
        issues.push({
          level: "error",
          code: "jsonld_drift",
          message: "JSON-LD itemReviewed.name не совпадает с названием казино",
        });
      }
    }
  } catch {
    issues.push({ level: "error", code: "jsonld_invalid", message: "JSON-LD не сериализуется" });
  }
  return issues;
}

export async function validateEntitySeo(
  pool: Pool,
  draft: Draft,
): Promise<SeoValidateResult> {
  const blockers: SeoIssue[] = [];
  const warnings: SeoIssue[] = [];
  const seo: EntitySeo = normalizeEntitySeo(draft.seo);
  const settings = await loadSeo(pool);
  const siteName = await pool
    .query(`select coalesce(nullif(site_name, ''), 'SSS Audit') as n from site_settings where id = 1`)
    .then((r) => String(r.rows[0]?.n || "SSS Audit"))
    .catch(() => "SSS Audit");

  const tpl = settings.templates[draft.kind] || { ru: {}, en: {} };
  const resolved = { ru: { title: "", description: "" }, en: { title: "", description: "" } };

  for (const loc of ["ru", "en"] as const) {
    const name = displayName(draft, loc);
    const vars: Record<string, string> = {
      siteName,
      casino: name,
      slot: name,
      article: name,
      name,
    };
    const overrideTitle = String(seo[loc]?.title || "").trim();
    const overrideDesc = String(seo[loc]?.description || "").trim();
    const tplTitle = String(tpl[loc]?.title || "").trim();
    const tplDesc = String(tpl[loc]?.description || "").trim();
    const title = applyVars(overrideTitle || tplTitle || name, vars);
    const description = applyVars(overrideDesc || tplDesc || bodyDesc(draft, loc), vars);
    resolved[loc] = { title, description };

    if (!name) {
      blockers.push({
        level: "error",
        code: "empty_name",
        locale: loc,
        message: loc === "en" ? "Empty entity name/title (EN)" : "Пустое название сущности (RU)",
      });
    }
    if (!title) {
      blockers.push({
        level: "error",
        code: "empty_title",
        locale: loc,
        message: loc === "en" ? "Resolved meta title is empty (EN)" : "Итоговый title пустой (RU)",
      });
    }
    if (!description) {
      blockers.push({
        level: "error",
        code: "empty_description",
        locale: loc,
        message: loc === "en" ? "Resolved meta description is empty (EN)" : "Итоговое description пустое (RU)",
      });
    }
    if (title.length > 70) {
      warnings.push({
        level: "warning",
        code: "title_long",
        locale: loc,
        message: `Title ${loc.toUpperCase()} ${title.length} знаков (>70)`,
      });
    }
    if (description.length > 180) {
      warnings.push({
        level: "warning",
        code: "desc_long",
        locale: loc,
        message: `Description ${loc.toUpperCase()} ${description.length} знаков (>180)`,
      });
    }
    if (name) {
      blockers.push(...jsonLdIssues(draft.kind, name, description).map((i) => ({ ...i, locale: loc })));
    }
  }

  const noindex = Boolean((draft.seo as { noindex?: unknown } | undefined)?.noindex);
  if (noindex && (draft.status === "published" || draft.status === "active")) {
    blockers.push({
      level: "error",
      code: "noindex_on_indexable",
      message: "noindex на индексируемом типе страницы — публикация заблокирована",
    });
  }
  if (!settings.indexingEnabled && (draft.status === "published" || draft.status === "active")) {
    warnings.push({
      level: "warning",
      code: "site_noindex",
      message: "Сайт в режиме noindex (Admin → SEO). Страница опубликуется, но боты её не индексируют.",
    });
  }

  // Unique resolved titles among published peers
  try {
    let peers: { id: string; slug: string; title: string; seo: unknown }[] = [];
    if (draft.kind === "casino") {
      const { rows } = await pool.query(
        `select id::text, slug,
                coalesce(nullif(name_ru, ''), name) as title,
                seo
         from casinos
         where status = 'published' and ($1::uuid is null or id <> $1)`,
        [draft.id || null],
      );
      peers = rows;
    } else if (draft.kind === "slot") {
      const { rows } = await pool.query(
        `select id::text, slug, title, seo
         from slots
         where status = 'published' and ($1::uuid is null or id <> $1)`,
        [draft.id || null],
      );
      peers = rows;
    } else {
      const { rows } = await pool.query(
        `select id::text, slug, title_ru as title, seo
         from articles
         where status = 'published' and ($1::uuid is null or id <> $1)`,
        [draft.id || null],
      );
      peers = rows;
    }
    const peerTitles = new Set(
      peers.flatMap((p) => {
        const e = normalizeEntitySeo(p.seo);
        const n = String(p.title || "").trim();
        const vars = { siteName, casino: n, slot: n, article: n, name: n };
        const ru = applyVars(String(e.ru.title || tpl.ru?.title || n).trim(), vars);
        const en = applyVars(String(e.en.title || tpl.en?.title || n).trim(), vars);
        return [ru.toLowerCase(), en.toLowerCase()].filter(Boolean);
      }),
    );
    for (const loc of ["ru", "en"] as const) {
      const t = resolved[loc].title.trim().toLowerCase();
      if (t && peerTitles.has(t)) {
        blockers.push({
          level: "error",
          code: "title_duplicate",
          locale: loc,
          message: `Title ${loc.toUpperCase()} уже используется у другой опубликованной сущности`,
        });
      }
    }
  } catch {
    warnings.push({
      level: "warning",
      code: "unique_check_failed",
      message: "Не удалось проверить уникальность title",
    });
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    resolved,
  };
}

export function shouldValidatePublish(nextStatus: string | undefined, prevStatus: string | undefined): boolean {
  return nextStatus === "published" || prevStatus === "published";
}

export async function registerSeoValidate(app: FastifyInstance, pool: Pool) {
  app.post("/v1/admin/seo/validate", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const body = z
      .object({
        kind: z.enum(["casino", "slot", "article"]),
        id: z.string().uuid().nullable().optional(),
        slug: z.string().max(160).nullable().optional(),
        status: z.string().max(40).nullable().optional(),
        name: z.string().max(300).nullable().optional(),
        name_ru: z.string().max(300).nullable().optional(),
        name_en: z.string().max(300).nullable().optional(),
        title: z.string().max(500).nullable().optional(),
        title_ru: z.string().max(500).nullable().optional(),
        title_en: z.string().max(500).nullable().optional(),
        short_desc_ru: z.string().max(5000).nullable().optional(),
        short_desc_en: z.string().max(5000).nullable().optional(),
        excerpt_ru: z.string().max(5000).nullable().optional(),
        excerpt_en: z.string().max(5000).nullable().optional(),
        description_ru: z.string().max(20000).nullable().optional(),
        description_en: z.string().max(20000).nullable().optional(),
        seo: z.unknown().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const result = await validateEntitySeo(pool, body.data);
    return { validation: result };
  });
}

import type { Pool } from "pg";
import { loadAiSettings } from "./settings.js";

function slugify(input: string, fallback = "parsed"): string {
  const s = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return s || fallback;
}

export type PromoteResult = {
  stagingId: string;
  contentType: string;
  liveId: string;
  liveSlug: string;
  jobId: string;
  autoPublish: boolean;
};

async function ensureArticle(
  pool: Pool,
  item: Record<string, unknown>,
): Promise<{ id: string; slug: string }> {
  if (item.live_id) {
    return { id: String(item.live_id), slug: String(item.live_slug || "") };
  }
  const payload = (item.payload || {}) as Record<string, unknown>;
  const base = slugify(String(item.title || "article"));
  const slug = `${base}-${String(item.id).slice(0, 8)}`;
  const locale = String(item.source_locale || "en").startsWith("ru") ? "ru" : "en";
  const title = String(item.title || "Parsed article").slice(0, 500);
  const body = item.body ? String(item.body) : null;
  const excerpt = body ? body.slice(0, 280) : null;
  const kind = String(payload.kind || "news").slice(0, 80);
  const topic = payload.topic != null ? String(payload.topic).slice(0, 120) : "parsed";

  const { rows } = await pool.query<{ id: string; slug: string }>(
    `
    insert into articles (
      slug, kind, topic,
      title_ru, title_en, excerpt_ru, excerpt_en, body_md_ru, body_md_en,
      status, reading_minutes
    ) values (
      $1, $2, $3,
      $4, $5, $6, $7, $8, $9,
      'draft', 5
    )
    returning id, slug
    `,
    [
      slug,
      kind,
      topic,
      locale === "ru" ? title : title,
      locale === "en" ? title : title,
      locale === "ru" ? excerpt : null,
      locale === "en" ? excerpt : null,
      locale === "ru" ? body : null,
      locale === "en" ? body : null,
    ],
  );
  return rows[0];
}

async function ensureCasino(
  pool: Pool,
  item: Record<string, unknown>,
): Promise<{ id: string; slug: string }> {
  if (item.live_id) {
    return { id: String(item.live_id), slug: String(item.live_slug || "") };
  }
  const payload = (item.payload || {}) as Record<string, unknown>;
  const name = String(payload.name || item.title || "Parsed Casino").slice(0, 200);
  const base = slugify(name, "casino");
  const slug = `${base}-${String(item.id).slice(0, 8)}`;
  const locale = String(item.source_locale || "en").startsWith("ru") ? "ru" : "en";
  const body = item.body ? String(item.body) : null;
  const short = payload.short != null ? String(payload.short).slice(0, 2000) : body?.slice(0, 280) || null;
  const license = payload.license != null ? String(payload.license).slice(0, 200) : null;

  const { rows } = await pool.query<{ id: string; slug: string }>(
    `
    insert into casinos (
      slug, name, name_ru, name_en, status, published,
      short_desc_ru, short_desc_en, description_ru, description_en,
      license, source, source_url
    ) values (
      $1, $2, $3, $4, 'draft', false,
      $5, $6, $7, $8,
      $9, 'parser', $10
    )
    returning id, slug
    `,
    [
      slug,
      name,
      locale === "ru" ? name : name,
      locale === "en" ? name : name,
      locale === "ru" ? short : null,
      locale === "en" ? short : null,
      locale === "ru" ? body : null,
      locale === "en" ? body : null,
      license,
      item.source_url ? String(item.source_url) : null,
    ],
  );
  return rows[0];
}

async function ensureSlot(
  pool: Pool,
  item: Record<string, unknown>,
): Promise<{ id: string; slug: string }> {
  if (item.live_id) {
    return { id: String(item.live_id), slug: String(item.live_slug || "") };
  }
  const payload = (item.payload || {}) as Record<string, unknown>;
  const title = String(payload.title || item.title || "Parsed Slot").slice(0, 200);
  const base = slugify(title, "slot");
  const slug = `${base}-${String(item.id).slice(0, 8)}`;
  const locale = String(item.source_locale || "en").startsWith("ru") ? "ru" : "en";
  const body = item.body ? String(item.body) : null;
  const theme = String(payload.theme || "other").slice(0, 80);
  const volatility = String(payload.volatility || "medium").slice(0, 40);
  const grid = payload.grid != null ? String(payload.grid).slice(0, 40) : null;

  const { rows } = await pool.query<{ id: string; slug: string }>(
    `
    insert into slots (
      slug, title, theme, volatility, grid,
      description_ru, description_en, status
    ) values (
      $1, $2, $3, $4, $5,
      $6, $7, 'draft'
    )
    returning id, slug
    `,
    [
      slug,
      title,
      theme,
      volatility,
      grid,
      locale === "ru" ? body : null,
      locale === "en" ? body : null,
    ],
  );
  return rows[0];
}

async function ensureForumCategory(
  pool: Pool,
  item: Record<string, unknown>,
): Promise<{ id: string; slug: string }> {
  if (item.live_id) {
    return { id: String(item.live_id), slug: String(item.live_slug || "") };
  }
  const payload = (item.payload || {}) as Record<string, unknown>;
  const titleEn = String(payload.title_en || item.title || "Parsed category").slice(0, 200);
  const titleRu = String(payload.title_ru || item.title || titleEn).slice(0, 200);
  const base = slugify(titleEn, "forum-cat");
  const slug = `${base}-${String(item.id).slice(0, 8)}`;
  const locale = String(item.source_locale || "en").startsWith("ru") ? "ru" : "en";
  const body = item.body ? String(item.body) : "";

  const { rows } = await pool.query<{ id: string; slug: string }>(
    `
    insert into forum_categories (
      slug, title_ru, title_en, description_ru, description_en, status, icon
    ) values (
      $1, $2, $3, $4, $5, 'draft', 'message-square'
    )
    returning id, slug
    `,
    [
      slug,
      titleRu,
      titleEn,
      locale === "ru" ? body : "",
      locale === "en" ? body : "",
    ],
  );
  return rows[0];
}

export function mapStagingJobType(contentType: string): "article" | "casino" | "slot" | "forum_category" {
  if (contentType === "casino") return "casino";
  if (contentType === "slot") return "slot";
  if (contentType === "forum" || contentType === "forum_category") return "forum_category";
  return "article";
}

/** Create/link live entity + enqueue AI job for a staging row. */
export async function promoteStagingItem(
  pool: Pool,
  opts: {
    stagingId: string;
    autoPublish?: boolean;
    createdBy?: string | null;
  },
): Promise<PromoteResult> {
  const { rows } = await pool.query(`select * from ai_staging where id = $1`, [opts.stagingId]);
  const item = rows[0] as Record<string, unknown> | undefined;
  if (!item) throw new Error("staging_not_found");
  if (item.process_status === "rejected") throw new Error("item_rejected");
  if (item.process_status === "processing" || item.ai_status === "processing") {
    throw new Error("already_processing");
  }
  if (item.process_status === "queued" || item.ai_status === "queued") {
    throw new Error("already_queued");
  }

  const settings = await loadAiSettings(pool);
  const autoPublish =
    opts.autoPublish === true ||
    (opts.autoPublish !== false && Boolean((settings as { auto_publish?: boolean } | null)?.auto_publish));

  const jobType = mapStagingJobType(String(item.content_type));
  let live: { id: string; slug: string };
  if (jobType === "casino") live = await ensureCasino(pool, item);
  else if (jobType === "slot") live = await ensureSlot(pool, item);
  else if (jobType === "forum_category") live = await ensureForumCategory(pool, item);
  else live = await ensureArticle(pool, item);

  const targets = settings?.target_locales?.length ? settings.target_locales : ["ru"];
  const sourceLocale = String(item.source_locale || settings?.source_locales?.[0] || "en");

  const { rows: jobs } = await pool.query<{ id: string }>(
    `
    insert into ai_jobs (
      content_type, content_id, content_slug, action, status,
      source_locale, target_locales, payload, created_by
    ) values (
      $1, $2, $3, 'process', 'pending',
      $4, $5, $6::jsonb, $7
    )
    returning id
    `,
    [
      jobType,
      live.id,
      live.slug,
      sourceLocale,
      targets,
      JSON.stringify({
        actions: ["unique", "translate"],
        stagingId: opts.stagingId,
        autoPublish,
      }),
      opts.createdBy ?? null,
    ],
  );

  await pool.query(
    `
    update ai_staging set
      live_id = $2,
      live_slug = $3,
      process_status = 'queued',
      ai_status = 'queued',
      ai_job_id = $4,
      error = null,
      content_type = case
        when content_type = 'forum' then 'forum'
        else content_type
      end,
      updated_at = now()
    where id = $1
    `,
    [opts.stagingId, live.id, live.slug, jobs[0].id],
  );

  return {
    stagingId: opts.stagingId,
    contentType: jobType,
    liveId: live.id,
    liveSlug: live.slug,
    jobId: jobs[0].id,
    autoPublish,
  };
}

/** After successful AI job: optionally publish live entity + mark staging published. */
export async function finalizeStagingPublish(
  pool: Pool,
  opts: {
    stagingId: string;
    contentType: string;
    liveId: string;
    autoPublish: boolean;
  },
) {
  if (opts.autoPublish) {
    if (opts.contentType === "article") {
      await pool.query(
        `
        update articles set
          status = 'published',
          published_at = coalesce(published_at, now()),
          updated_at = now()
        where id = $1
        `,
        [opts.liveId],
      );
    } else if (opts.contentType === "casino") {
      await pool.query(
        `
        update casinos set
          status = 'published',
          published = true,
          updated_at = now()
        where id = $1
        `,
        [opts.liveId],
      );
    } else if (opts.contentType === "slot") {
      await pool.query(
        `update slots set status = 'published' where id = $1`,
        [opts.liveId],
      );
    } else if (opts.contentType === "forum_category") {
      await pool.query(
        `update forum_categories set status = 'published' where id = $1`,
        [opts.liveId],
      );
    }
  }

  await pool.query(
    `
    update ai_staging set
      ai_status = 'done',
      ai_processed_at = now(),
      process_status = case when $2 then 'published' else 'ai_done' end,
      published = $2,
      published_at = case when $2 then now() else published_at end,
      updated_at = now()
    where id = $1
    `,
    [opts.stagingId, opts.autoPublish],
  );
}

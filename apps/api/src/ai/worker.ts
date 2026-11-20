import type { Pool } from "pg";
import { autoQueueStaging } from "./autoqueue.js";
import { finalizeStagingPublish } from "./promote-staging.js";
import { processArticle } from "./process-article.js";
import { processEntity } from "./process-entity.js";

type JobRow = {
  id: string;
  content_type: string;
  content_id: string | null;
  action: string;
  source_locale: string | null;
  target_locales: string[];
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let poolRef: Pool | null = null;

async function claimNextJob(pool: Pool): Promise<JobRow | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<JobRow>(
      `
      select id, content_type, content_id, action, source_locale, target_locales, payload, attempts, max_attempts
      from ai_jobs
      where status = 'pending'
        and attempts < max_attempts
      order by created_at asc
      for update skip locked
      limit 1
      `,
    );
    const job = rows[0];
    if (!job) {
      await client.query("commit");
      return null;
    }
    await client.query(
      `
      update ai_jobs set
        status = 'processing',
        attempts = attempts + 1,
        started_at = coalesce(started_at, now()),
        error = null
      where id = $1
      `,
      [job.id],
    );
    await client.query("commit");
    return job;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function finishJob(
  pool: Pool,
  jobId: string,
  ok: boolean,
  opts: {
    result?: Record<string, unknown>;
    error?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    model?: string;
    retry?: boolean;
  },
) {
  if (ok) {
    await pool.query(
      `
      update ai_jobs set
        status = 'done',
        result = $2::jsonb,
        prompt_tokens = $3,
        completion_tokens = $4,
        total_tokens = $5,
        model = coalesce($6, model),
        finished_at = now(),
        error = null
      where id = $1
      `,
      [
        jobId,
        JSON.stringify(opts.result || {}),
        opts.promptTokens ?? 0,
        opts.completionTokens ?? 0,
        opts.totalTokens ?? 0,
        opts.model ?? null,
      ],
    );
    return;
  }

  if (opts.retry) {
    await pool.query(
      `
      update ai_jobs set
        status = case when attempts < max_attempts then 'pending' else 'failed' end,
        error = $2,
        finished_at = case when attempts < max_attempts then null else now() end
      where id = $1
      `,
      [jobId, opts.error || "error"],
    );
    return;
  }

  await pool.query(
    `
    update ai_jobs set
      status = 'failed',
      error = $2,
      finished_at = now()
    where id = $1
    `,
    [jobId, opts.error || "error"],
  );
}

const ENTITY_TABLE: Record<string, string> = {
  casino: "casinos",
  slot: "slots",
  forum_category: "forum_categories",
};

async function runOne(pool: Pool) {
  const job = await claimNextJob(pool);
  if (!job) return false;

  try {
    const payload = job.payload || {};
    const actions = Array.isArray(payload.actions)
      ? (payload.actions as Array<"unique" | "translate">)
      : undefined;

    if (job.content_type === "article" && job.content_id) {
      const result = await processArticle(pool, {
        articleId: job.content_id,
        sourceLocale: job.source_locale,
        targetLocales: job.target_locales,
        actions,
      });
      await pool.query(`update articles set ai_job_id = $1 where id = $2`, [
        job.id,
        job.content_id,
      ]);
      const stagingId =
        typeof payload.stagingId === "string" ? payload.stagingId : null;
      if (stagingId) {
        await finalizeStagingPublish(pool, {
          stagingId,
          contentType: "article",
          liveId: job.content_id,
          autoPublish: payload.autoPublish === true,
        });
        await pool.query(`update ai_staging set ai_job_id = $2 where id = $1`, [
          stagingId,
          job.id,
        ]);
      }
      await finishJob(pool, job.id, true, {
        result: result as unknown as Record<string, unknown>,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        model: result.model,
      });
    } else if (
      (job.content_type === "casino" ||
        job.content_type === "slot" ||
        job.content_type === "forum_category") &&
      job.content_id
    ) {
      const result = await processEntity(pool, {
        contentType: job.content_type,
        entityId: job.content_id,
        sourceLocale: job.source_locale,
        targetLocales: job.target_locales,
        actions,
      });
      const table = ENTITY_TABLE[job.content_type];
      await pool.query(`update ${table} set ai_job_id = $1 where id = $2`, [
        job.id,
        job.content_id,
      ]);
      const stagingId =
        typeof payload.stagingId === "string" ? payload.stagingId : null;
      if (stagingId) {
        await finalizeStagingPublish(pool, {
          stagingId,
          contentType: job.content_type,
          liveId: job.content_id,
          autoPublish: payload.autoPublish === true,
        });
        await pool.query(`update ai_staging set ai_job_id = $2 where id = $1`, [
          stagingId,
          job.id,
        ]);
      }
      await finishJob(pool, job.id, true, {
        result: result as unknown as Record<string, unknown>,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        model: result.model,
      });
    } else {
      await finishJob(pool, job.id, false, {
        error: `unsupported_content_type:${job.content_type}`,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "job_failed";
    const retryable = ![
      "openai_api_key_missing",
      "ai_disabled",
      "article_not_found",
      "article_empty_source",
      "entity_not_found",
      "entity_empty_source",
      "daily_token_limit_reached",
      "unsupported_entity",
    ].includes(msg);
    const stagingId =
      typeof job.payload?.stagingId === "string" ? job.payload.stagingId : null;
    if (stagingId && !retryable) {
      await pool.query(
        `
        update ai_staging set
          ai_status = 'error',
          process_status = 'error',
          error = $2,
          updated_at = now()
        where id = $1
        `,
        [stagingId, msg],
      );
    }
    await finishJob(pool, job.id, false, { error: msg, retry: retryable });
  }
  return true;
}

export async function tickAiWorker(pool: Pool) {
  if (running) return;
  running = true;
  try {
    try {
      await autoQueueStaging(pool, 3);
    } catch (err) {
      console.error("[ai-autoqueue]", err);
    }
    for (let i = 0; i < 2; i++) {
      const did = await runOne(pool);
      if (!did) break;
    }
  } catch (err) {
    console.error("[ai-worker]", err);
  } finally {
    running = false;
  }
}

export function startAiWorker(pool: Pool, intervalMs = 5000) {
  poolRef = pool;
  if (timer) return;
  void tickAiWorker(pool);
  timer = setInterval(() => {
    if (poolRef) void tickAiWorker(poolRef);
  }, intervalMs);
  if (typeof timer === "object" && "unref" in timer) {
    (timer as NodeJS.Timeout).unref();
  }
}

export function stopAiWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  poolRef = null;
}

import type { Pool } from "pg";
import { promoteStagingItem } from "./promote-staging.js";
import { loadAiSettings } from "./settings.js";

/**
 * When auto_process is enabled, promote staging `new` items into live drafts + AI jobs.
 * auto_publish (settings) controls whether AI completion publishes to the site.
 */
export async function autoQueueStaging(pool: Pool, limit = 3): Promise<number> {
  const settings = await loadAiSettings(pool);
  if (!settings?.auto_process || settings.enabled === false) return 0;

  const { rows } = await pool.query<{ id: string }>(
    `
    select id
    from ai_staging
    where process_status = 'new'
      and ai_status = 'none'
      and content_type in ('article', 'casino', 'slot', 'forum')
    order by scraped_at asc
    limit $1
    `,
    [limit],
  );

  let queued = 0;
  for (const row of rows) {
    try {
      await promoteStagingItem(pool, {
        stagingId: row.id,
        autoPublish: Boolean(settings.auto_publish),
      });
      queued += 1;
    } catch (err) {
      console.error("[ai-autoqueue] item", row.id, err);
    }
  }
  return queued;
}

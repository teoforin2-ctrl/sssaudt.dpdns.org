import type { Pool } from "pg";
import { mergeRewardSettings, type RewardSettings } from "@x-reviewer/shared";

export async function loadRewardSettings(pool: Pool): Promise<RewardSettings> {
  try {
    const { rows } = await pool.query<{ reward_settings: unknown }>(
      `select reward_settings from site_settings where id = 1`,
    );
    return mergeRewardSettings(rows[0]?.reward_settings);
  } catch {
    return mergeRewardSettings({});
  }
}

/** A/B reward config — mock payouts, no on-chain. */

export type RewardGroup = "A" | "B";

export type RewardWheelRow = { amount: number; p: number };

export type RewardSettings = {
  enabled: boolean;
  currency: string;
  network: string;
  explorerTxTemplate: string;
  fixedAmountA: number;
  rewardPreviewB: string;
  wheelTable: RewardWheelRow[];
  /** mock | provider — real provider TBD */
  payoutMode: "mock" | "provider";
  minReviewChars: number;
  moderationDelayMs: number;
  payoutDelayMs: number;
  rateLimitPerHour: number;
  blockDuplicateWallet: boolean;
  maxPaidReviewsPerPlayerCasino: number;
};

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  enabled: true,
  currency: "USDT",
  network: "TRON (TRC-20)",
  explorerTxTemplate: "https://tronscan.org/#/transaction/{hash}",
  fixedAmountA: 1,
  rewardPreviewB: "случайную награду до $100",
  wheelTable: [
    { amount: 0.5, p: 0.538 },
    { amount: 1, p: 0.34 },
    { amount: 1.5, p: 0.1 },
    { amount: 2, p: 0.02 },
    { amount: 100, p: 0.002 },
  ],
  payoutMode: "mock",
  minReviewChars: 250,
  moderationDelayMs: 2500,
  payoutDelayMs: 2000,
  rateLimitPerHour: 5,
  blockDuplicateWallet: true,
  maxPaidReviewsPerPlayerCasino: 1,
};

/** @deprecated use settings.fixedAmountA */
export const REWARD_FIXED_A_USD = DEFAULT_REWARD_SETTINGS.fixedAmountA;

/** @deprecated use settings.wheelTable */
export const REWARD_B_TABLE = DEFAULT_REWARD_SETTINGS.wheelTable;

/** Visual wheel sectors (counts ≠ probabilities). */
export const REWARD_WHEEL_SECTORS = [0.5, 1, 1.5, 2, 0.5, 1, 100, 0.5, 1.5] as const;

export const REWARD_CURRENCY = DEFAULT_REWARD_SETTINGS.currency;
export const REWARD_NETWORK = DEFAULT_REWARD_SETTINGS.network;
export const REWARD_EXPLORER_TX = DEFAULT_REWARD_SETTINGS.explorerTxTemplate;

export function mergeRewardSettings(raw: unknown): RewardSettings {
  const base = { ...DEFAULT_REWARD_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  if (typeof o.enabled === "boolean") base.enabled = o.enabled;
  if (typeof o.currency === "string" && o.currency.trim()) base.currency = o.currency.trim();
  if (typeof o.network === "string" && o.network.trim()) base.network = o.network.trim();
  if (typeof o.explorerTxTemplate === "string" && o.explorerTxTemplate.includes("{hash}")) {
    base.explorerTxTemplate = o.explorerTxTemplate.trim();
  }
  if (typeof o.fixedAmountA === "number" && o.fixedAmountA > 0) base.fixedAmountA = o.fixedAmountA;
  if (typeof o.rewardPreviewB === "string") base.rewardPreviewB = o.rewardPreviewB;
  if (o.payoutMode === "mock" || o.payoutMode === "provider") base.payoutMode = o.payoutMode;
  if (typeof o.minReviewChars === "number" && o.minReviewChars >= 50) {
    base.minReviewChars = Math.floor(o.minReviewChars);
  }
  if (typeof o.moderationDelayMs === "number" && o.moderationDelayMs >= 0) {
    base.moderationDelayMs = Math.floor(o.moderationDelayMs);
  }
  if (typeof o.payoutDelayMs === "number" && o.payoutDelayMs >= 0) {
    base.payoutDelayMs = Math.floor(o.payoutDelayMs);
  }
  if (typeof o.rateLimitPerHour === "number" && o.rateLimitPerHour >= 1) {
    base.rateLimitPerHour = Math.floor(o.rateLimitPerHour);
  }
  if (typeof o.blockDuplicateWallet === "boolean") base.blockDuplicateWallet = o.blockDuplicateWallet;
  if (typeof o.maxPaidReviewsPerPlayerCasino === "number" && o.maxPaidReviewsPerPlayerCasino >= 1) {
    base.maxPaidReviewsPerPlayerCasino = Math.floor(o.maxPaidReviewsPerPlayerCasino);
  }
  if (Array.isArray(o.wheelTable) && o.wheelTable.length) {
    const rows: RewardWheelRow[] = [];
    for (const row of o.wheelTable) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const amount = Number(r.amount);
      const p = Number(r.p);
      if (Number.isFinite(amount) && amount > 0 && Number.isFinite(p) && p > 0) {
        rows.push({ amount, p });
      }
    }
    if (rows.length) base.wheelTable = rows;
  }
  return base;
}

export function pickRewardGroup(rng = Math.random()): RewardGroup {
  return rng < 0.5 ? "A" : "B";
}

export function rollRewardB(
  table: RewardWheelRow[] = DEFAULT_REWARD_SETTINGS.wheelTable,
  rng = Math.random(),
): number {
  let acc = 0;
  for (const row of table) {
    acc += row.p;
    if (rng < acc) return row.amount;
  }
  return table[table.length - 1]?.amount ?? 1;
}

/** TRC-20 address: T + 33 base58 chars. */
export function isTrc20Address(addr: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr.trim());
}

export function formatRewardUsd(amount: number): string {
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

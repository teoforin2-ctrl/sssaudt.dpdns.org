export type Locale = "ru" | "en";

export type UserRole = "author" | "editor" | "admin" | "partner_rep";

export interface HealthResponse {
  ok: true;
  service: string;
  ts: string;
}

export interface CasinoListItem {
  id: string;
  slug: string;
  name: string;
  rating: number;
  hot: boolean;
  top: boolean;
  bonusLabel?: string;
}

export * from "./rating.js";
export * from "./keywords.js";
export * from "./moderation.js";
export * from "./reward.js";
export * from "./features.js";
export * from "./promo.js";
export * from "./search.js";
export * from "./text.js";

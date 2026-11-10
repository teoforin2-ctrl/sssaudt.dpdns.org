/** Rating math for Casino review MVP.
 * [ASSUMPTION] weights TBD with business — exported as constants.
 */

export const RATING_WEIGHT_EDITORIAL = 0.6;
export const RATING_WEIGHT_PLAYERS = 0.4;
export const UGC_MIN_FOR_PLAYER_SCORE = 5;
export const HOT_BONUS = 1;
export const CLAMP_DISPLAY_RATING_TO_5 = true;

export type ReviewForScore = {
  stars: number;
  origin: "ugc" | "editorial";
  moderationStatus: "pending" | "approved" | "rejected";
};

export function calcPlayerScore(reviews: ReviewForScore[]): number | null {
  const ugc = reviews.filter((r) => r.origin === "ugc" && r.moderationStatus === "approved");
  if (ugc.length < UGC_MIN_FOR_PLAYER_SCORE) return null;
  const avg = ugc.reduce((s, r) => s + r.stars, 0) / ugc.length;
  return round1(avg);
}

export function calcBaseRating(editorial: number, playerScore: number | null): number {
  if (playerScore == null) return editorial;
  return RATING_WEIGHT_EDITORIAL * editorial + RATING_WEIGHT_PLAYERS * playerScore;
}

/** Sort key — may exceed 5 when HOT is on */
export function calcFinalRating(baseRating: number, hasHot: boolean): number {
  return baseRating + (hasHot ? HOT_BONUS : 0);
}

export function calcDisplayRating(finalRating: number): number {
  const v = CLAMP_DISPLAY_RATING_TO_5 ? Math.min(finalRating, 5) : finalRating;
  return round1(v);
}

export type SortCasino = {
  id: string;
  finalRating: number;
  hot: boolean;
  hasRepresentative: boolean;
};

/** finalRating ↓ → HOT → representative → id ↓ */
export function sortCasinos<T extends SortCasino>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (b.finalRating !== a.finalRating) return b.finalRating - a.finalRating;
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    if (a.hasRepresentative !== b.hasRepresentative) return a.hasRepresentative ? -1 : 1;
    return b.id.localeCompare(a.id);
  });
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

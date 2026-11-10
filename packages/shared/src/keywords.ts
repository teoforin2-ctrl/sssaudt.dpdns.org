/** Moderation keyword stems — RU/EN forms for casino-themed reviews */
export const REVIEW_KEYWORDS = [
  "казино",
  "casino",
  "игра",
  "game",
  "играть",
  "play",
  "депозит",
  "deposit",
  "вывод",
  "withdraw",
  "выигрыш",
  "winning",
  "бонус",
  "bonus",
  "ставка",
  "bet",
  "слот",
  "slot",
  "деньги",
  "money",
] as const;

export function hasReviewKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return REVIEW_KEYWORDS.some((k) => lower.includes(k));
}

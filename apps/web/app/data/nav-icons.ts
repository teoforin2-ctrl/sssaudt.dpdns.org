/** Maps nav paths / column keys → cat-* icon slug.
 * Files: `/img/cats/{24|48|96}/cat-{slug}.webp`
 */

export type CatIconSize = 24 | 48 | 96;

/** Pick asset size for a CSS pixel box (prefer ~2× when a larger tier exists). */
export function catIconSizeForCss(cssPx: number): CatIconSize {
  if (cssPx <= 24) return 24;
  if (cssPx <= 40) return 48;
  return 96;
}

export function catIcon(slug: string, size: CatIconSize = 24): string {
  return `/img/cats/${size}/cat-${slug}.webp`;
}

/** Convenience: path for a given on-screen CSS size. */
export function catIconCss(slug: string, cssPx: number): string {
  return catIcon(slug, catIconSizeForCss(cssPx));
}

const byPath: Record<string, string> = {
  "/rating": "casinos",
  "/rating/best": "trophy",
  "/rating/reliable": "reliable",
  "/rating/top-5": "podium",
  "/rating/licensed": "licensed",
  "/rating/whitelist": "whitelist",
  "/rating/fair": "fair",
  "/rating/popular": "popular",
  "/rating/reputation": "reviews",
  "/rating/for-beginners": "beginners",
  "/rating/high-rollers": "vip",
  "/rating/verified": "verified",
  "/rating/curacao": "shield",
  "/rating/malta": "licensed",
  "/rating/instant-payout": "instant",
  "/rating/min-deposit": "min-deposit",
  "/rating/min-bets": "dice",
  "/rating/no-deposit-play": "nodeposit",
  "/rating/world-best": "globe",
  "/rating/no-first-deposit": "nodeposit",
  "/rating/runet": "casinos",
  "/rating/new": "newyear",
  "/rating/payments": "wallet",
  "/rating/payments/visa": "wallet",
  "/rating/payments/mastercard": "wallet",
  "/rating/payments/mir": "wallet",
  "/rating/payments/sbp": "wallet",
  "/rating/payments/sberbank": "wallet",
  "/rating/payments/tinkoff": "wallet",
  "/rating/payments/apple-pay": "mobile",
  "/rating/payments/google-pay": "mobile",
  "/rating/payments/paypal": "wallet",
  "/rating/payments/skrill": "wallet",
  "/rating/payments/neteller": "wallet",
  "/rating/payments/qiwi": "wallet",
  "/rating/payments/payeer": "wallet",
  "/rating/payments/paysafecard": "wallet",
  "/rating/payments/sms": "mobile",
  "/rating/payments/usdt": "crypto",
  "/rating/crypto": "crypto",
  "/rating/crypto/bitcoin": "crypto",
  "/rating/crypto/ethereum": "crypto",
  "/rating/crypto/usdt": "crypto",
  "/rating/crypto/litecoin": "crypto",
  "/rating/crypto/dogecoin": "crypto",
  "/rating/crypto/tron": "crypto",
  "/rating/crypto/ripple": "crypto",
  "/rating/crypto/monero": "crypto",
  "/rating/crypto/bitcoin-cash": "crypto",
  "/rating/currency/rub": "currency",
  "/rating/currency/usd": "currency",
  "/rating/currency/uah": "currency",
  "/rating/currency/kzt": "currency",
  "/rating/currency/pln": "currency",
  "/rating/platforms/mobile": "mobile",
  "/rating/platforms/ios": "mobile",
  "/rating/platforms/android": "mobile",
  "/rating/platforms/ipad": "mobile",
  "/rating/platforms/telegram": "telegram",
  "/rating/platforms/app": "mobile",
  "/rating/platforms/softswiss": "providers",
  "/rating/countries/russia": "globe",
  "/rating/countries/belarus": "globe",
  "/rating/countries/ukraine": "globe",
  "/rating/countries/kazakhstan": "globe",
  "/rating/countries/europe": "globe",
  "/rating/countries/usa": "globe",
  "/rating/countries/uk": "globe",
  "/rating/countries/latvia": "globe",
  "/rating/countries/estonia": "globe",
  "/rating/countries/china": "asia",
  "/rating/countries/foreign": "globe",
  "/rating/features/min-deposit-10": "min-deposit",
  "/rating/features/deposit-1-eur": "min-deposit",
  "/rating/features/no-withdraw-limit": "wallet",
  "/rating/features/sports-betting": "sports",
  "/rating/features/no-kyc": "no-kyc",
  "/rating/features/demo": "demo",
  "/rating/features/no-sms": "mobile",
  "/rating/features/live-casino": "live-dealer",
  "/rating/features/baccarat": "baccarat",
  "/rating/features/blackjack": "blackjack",
  "/rating/features/poker": "poker",
  "/rating/features/bingo": "bingo",
  "/rating/features/signup-bonus": "welcome",
  "/rating/features/virtual": "demo",
  "/rating/features/no-scam": "fair",
  "/rating/features/high-limits": "vip",
  "/rating/features/crypto-no-kyc": "no-kyc",
  "/rating/blacklist": "blacklist",

  "/bonuses": "bonus",
  "/bonuses/welcome": "welcome",
  "/bonuses/no-deposit": "nodeposit",
  "/bonuses/promotions": "promotions",
  "/bonuses/free-spins": "freespins",
  "/bonuses/cashback": "cashback",
  "/bonuses/reload": "reload",
  "/bonuses/vip": "vip",
  "/bonuses/bookmakers": "sports",
  "/bonuses/codes": "promo-code",

  "/slots": "slots",
  "/slots/providers": "providers",
  "/slots/new": "newyear",
  "/slots/top-10": "trophy",
  "/slots/demo": "demo",
  "/slots/jackpot": "jackpot",
  "/slots/high-rtp": "high-rtp",
  "/slots/games/slots": "slots",
  "/slots/games/roulette": "roulette",
  "/slots/games/french-roulette": "roulette",
  "/slots/games/european-roulette": "roulette",
  "/slots/games/american-roulette": "roulette",
  "/slots/games/poker": "poker",
  "/slots/games/video-poker": "videopoker",
  "/slots/games/blackjack": "blackjack",
  "/slots/games/baccarat": "baccarat",
  "/slots/games/bingo": "bingo",
  "/slots/games/keno": "keno",
  "/slots/games/crash": "crash",
  "/slots/games/plinko": "plinko",
  "/slots/games/mines": "mines",
  "/slots/games/dice": "dice",
  "/slots/games/scratch": "scratch",
  "/slots/games/table": "table-games",
  "/slots/games/fast": "instant",
  "/slots/genres/classic": "777",
  "/slots/genres/old": "history",
  "/slots/genres/3d": "neon",
  "/slots/genres/buy-bonus": "bonus-buy",
  "/slots/genres/low-volatility": "volatility-low",
  "/slots/genres/high-volatility": "volatility-high",
  "/slots/genres/video-slots": "slots",
  "/slots/genres/fruit": "777",
  "/slots/genres/egypt": "egypt",
  "/slots/genres/adventure": "adventure",
  "/slots/genres/magic": "magic",
  "/slots/genres/sports": "sports",
  "/slots/genres/pirates": "pirates",
  "/slots/genres/anime": "anime",
  "/slots/genres/comics": "comics",
  "/slots/platform/mobile": "mobile",
  "/slots/platform/desktop": "desktop",

  "/poker": "poker",

  "/articles": "articles",
  "/articles/news": "news",
  "/articles/slot-cards": "slots",
  "/articles/providers": "providers",
  "/articles/glossary": "academy",
  "/articles/mechanics-guides": "guides",
  "/articles/collections": "trophy",
  "/articles/guides": "guides",
  "/articles/academy": "academy",
  "/articles/rules": "table-games",
  "/articles/analytics": "analytics",
  "/articles/interviews": "interviews",
  "/articles/history": "history",
  "/articles/top-games": "trophy",
  "/articles/cult-casinos": "landbased",
  "/articles/celebrities": "vip",
  "/articles/infographics": "analytics",
  "/faq": "faq",
  "/forum": "forum",
  "/b2b": "casinos",
  "/about": "academy",
  "/how-we-earn": "affiliates",
  "/contacts": "complaint",
  "/search": "news",
  "/articles/faq": "faq",
  "/articles/tournaments": "sports",
  "/articles/affiliates": "affiliates",
  "/articles/safety": "safety",

  "/more": "more",
  "/more/bookmakers": "sports",
  "/more/land-based": "landbased",
  "/more/tournaments": "sports",
  "/more/academy": "academy",
  "/more/news": "news",
  "/more/faq": "faq",
  "/more/complaint": "complaint",
  "/legal/responsible-gambling": "safety",
  "/sitemap": "sitemap",
};

const byColumn: Record<string, string> = {
  "Лучшие": "trophy",
  Best: "trophy",
  "Новые": "newyear",
  New: "newyear",
  "Ввод / вывод": "wallet",
  "Deposit / withdraw": "wallet",
  "Криптовалюты": "crypto",
  Crypto: "crypto",
  "Валюты": "currency",
  Currencies: "currency",
  "Платформы": "mobile",
  Platforms: "mobile",
  "Страны": "globe",
  Countries: "globe",
  "Особенности": "features",
  Features: "features",
  "Чёрный список": "blacklist",
  Blacklist: "blacklist",
  "Бонусы казино": "bonus",
  "Casino bonuses": "bonus",
  "Другое": "promo-code",
  Other: "promo-code",
  "Обзор": "slots",
  Overview: "slots",
  "Виды игр": "table-games",
  "Game types": "table-games",
  "Жанры": "egypt",
  Genres: "egypt",
  "Платформа": "desktop",
  Platform: "desktop",
  "Материалы": "articles",
  Content: "articles",
  "Разделы": "more",
  Sections: "more",
};

const bySection: Record<string, string> = {
  casinos: "casinos",
  rating: "casinos",
  bonuses: "bonus",
  slots: "slots",
  poker: "poker",
  articles: "articles",
  forum: "forum",
  more: "more",
};

export function iconForPath(path: string, fallback = "casinos"): string {
  if (byPath[path]) return byPath[path];
  if (path.includes("/crypto")) return "crypto";
  if (path.includes("/payments")) return "wallet";
  if (path.includes("/currency")) return "currency";
  if (path.includes("/platforms/telegram")) return "telegram";
  if (path.includes("/platforms") || path.includes("/mobile")) return "mobile";
  if (path.includes("/countries")) return "globe";
  if (path.includes("/features/live")) return "live-dealer";
  if (path.includes("/features/no-kyc") || path.includes("crypto-no-kyc")) return "no-kyc";
  if (path.includes("/genres/")) return "slots";
  if (path.includes("/games/")) return "slots";
  return fallback;
}

export function iconForColumn(titleRu: string): string {
  return byColumn[titleRu] || "casinos";
}

export function iconForSection(id: string): string {
  return bySection[id] || "casinos";
}

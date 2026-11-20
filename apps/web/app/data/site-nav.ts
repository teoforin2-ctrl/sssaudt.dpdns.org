/** Site navigation — aligned with `_old` SiteHeader (our routes). */

export type LocText = { ru: string; en: string };

export type NavLink = {
  path: string;
  title: LocText;
};

export type NavColumn = {
  title: LocText;
  items: NavLink[];
};

export type NavSection = {
  id: string;
  path: string;
  title: LocText;
  /** Mega-menu columns; omit for a plain link */
  columns?: NavColumn[];
};

const t = (ru: string, en: string): LocText => ({ ru, en });
const link = (path: string, ru: string, en: string): NavLink => ({
  path,
  title: t(ru, en),
});

/**
 * Active header menu (как в `_old`):
 * Онлайн-казино · Слоты · Бонусы · Статьи · Форум
 * (Чёрный список / B2B — закомментированы до готовности)
 */
export const siteNav: NavSection[] = [
  {
    id: "casinos",
    path: "/rating",
    title: t("Онлайн-казино", "Online casinos"),
    columns: [
      {
        title: t("Казино", "Casinos"),
        items: [
          link("/rating", "Каталог", "Catalog"),
          link("/rating/new", "Новые", "New"),
          link("/rating/licensed", "С лицензией", "Licensed"),
          link("/rating/crypto", "Крипто", "Crypto"),
        ],
      },
    ],
  },
  {
    id: "slots",
    path: "/slots",
    title: t("Слоты", "Slots"),
    columns: [
      {
        title: t("Слоты", "Slots"),
        items: [
          link("/slots", "Популярные", "Popular"),
          link("/slots/new", "Новинки", "New"),
          link("/slots/providers", "Провайдеры", "Providers"),
          // link("/slots/analytics", "С обзором", "With review"),
        ],
      },
    ],
  },
  {
    id: "bonuses",
    path: "/bonuses",
    title: t("Бонусы", "Bonuses"),
    columns: [
      {
        title: t("Бонусы", "Bonuses"),
        items: [
          link("/bonuses/welcome", "Приветственные", "Welcome"),
          link("/bonuses/no-deposit", "Бездеп", "No deposit"),
          link("/bonuses/free-spins", "Фриспины", "Free spins"),
          link("/bonuses/codes", "Промокоды", "Promo codes"),
        ],
      },
    ],
  },
  {
    id: "articles",
    path: "/articles",
    title: t("Статьи", "Articles"),
    columns: [
      {
        title: t("Статьи", "Articles"),
        items: [
          link("/articles/slot-cards", "Карточки слотов", "Slot cards"),
          link("/articles/providers", "Провайдеры", "Providers"),
          link("/articles/glossary", "Справочник и глоссарий", "Reference & glossary"),
          link("/articles/mechanics-guides", "Гайды по механикам", "Mechanics guides"),
          link("/articles/news", "Новости", "News"),
          link("/articles/collections", "Подборки", "Collections"),
        ],
      },
    ],
  },
  {
    id: "forum",
    path: "/forum",
    title: t("Форум", "Forum"),
  },
  {
    id: "b2b",
    path: "/b2b",
    title: t("Казино под ключ", "Turnkey casino"),
  },
  // {
  //   id: "blacklist",
  //   path: "/rating/blacklist",
  //   title: t("Чёрный список", "Blacklist"),
  // },
];

export const footerNav: { title: LocText; items: NavLink[] }[] = [
  {
    title: t("Рейтинг", "Ranking"),
    items: [
      link("/rating", "Все казино", "All casinos"),
      link("/rating/new", "Новые", "New"),
      link("/rating/crypto", "Криптоказино", "Crypto"),
      link("/rating/payments", "Способы оплаты", "Payments"),
      link("/rating/blacklist", "Чёрный список", "Blacklist"),
      link("/compare", "Сравнение", "Compare"),
      link("/methodology", "Методика рейтинга", "Rating method"),
    ],
  },
  {
    title: t("Бонусы и игры", "Bonuses & games"),
    items: [
      link("/bonuses", "Все бонусы", "All bonuses"),
      link("/bonuses/welcome", "Приветственные", "Welcome"),
      link("/bonuses/no-deposit", "Бездепозитные", "No deposit"),
      link("/slots", "Слоты", "Slots"),
      link("/slots/providers", "Провайдеры", "Providers"),
      // link("/poker", "Покер-румы", "Poker rooms"),
    ],
  },
  {
    title: t("Материалы", "Content"),
    items: [
      link("/articles", "Статьи", "Articles"),
      link("/articles/slot-cards", "Карточки слотов", "Slot cards"),
      link("/articles/providers", "Провайдеры", "Providers"),
      link("/articles/glossary", "Справочник", "Glossary"),
      link("/articles/mechanics-guides", "Гайды по механикам", "Mechanics guides"),
      link("/articles/news", "Новости", "News"),
      link("/articles/collections", "Подборки", "Collections"),
      link("/faq", "FAQ", "FAQ"),
      link("/about", "О нас", "About"),
      link("/how-we-earn", "Как мы зарабатываем", "How we earn"),
      link("/contacts", "Контакты", "Contacts"),
      link("/b2b", "Разработка казино", "Casino development"),
      link("/forum", "Форум", "Forum"),
      link("/search", "Поиск", "Search"),
      link("/sitemap", "Карта сайта", "Sitemap"),
    ],
  },
];


/**
 * Archived mega-menu (casino.ru-style). Keep for later restoration.
 * Not used by the header — see `siteNav` above.
 */
export const siteNavArchived: NavSection[] = [
  {
    id: "rating",
    path: "/rating",
    title: t("Рейтинг казино", "Casino ranking"),
    columns: [
      {
        title: t("Лучшие", "Best"),
        items: [
          link("/rating", "Все", "All"),
          link("/rating/best", "Лучшие", "Best"),
          link("/rating/reliable", "Надёжные", "Reliable"),
          link("/rating/top-5", "ТОП-5", "Top 5"),
          link("/rating/licensed", "Лицензионные", "Licensed"),
          link("/rating/whitelist", "Белый список", "Whitelist"),
          link("/rating/fair", "Честные", "Fair"),
          link("/rating/popular", "Популярные", "Popular"),
          link("/rating/reputation", "С репутацией", "Good reputation"),
          link("/rating/for-beginners", "Для новичков", "For beginners"),
          link("/rating/high-rollers", "Для хайроллеров", "High rollers"),
          link("/rating/verified", "Проверенные", "Verified"),
          link("/rating/curacao", "Лицензия Кюрасао", "Curaçao license"),
          link("/rating/malta", "Лицензия Мальты", "Malta license"),
          link("/rating/instant-payout", "Моментальный вывод", "Instant payout"),
          link("/rating/min-deposit", "Минимальный депозит", "Min deposit"),
          link("/rating/min-bets", "Минимальные ставки", "Min bets"),
          link("/rating/no-deposit-play", "Без вложений", "No deposit play"),
          link("/rating/world-best", "Лучшие казино мира", "World’s best"),
          link("/rating/no-first-deposit", "Без первого взноса", "No first deposit"),
          link("/rating/runet", "Лучшие казино Рунета", "Best in Runet"),
        ],
      },
      {
        title: t("Новые", "New"),
        items: [link("/rating/new", "Новые казино", "New casinos")],
      },
      {
        title: t("Ввод / вывод", "Deposit / withdraw"),
        items: [
          link("/rating/payments", "Все способы", "All methods"),
          link("/rating/payments/visa", "Visa", "Visa"),
          link("/rating/payments/mastercard", "Mastercard", "Mastercard"),
          link("/rating/payments/mir", "МИР", "MIR"),
          link("/rating/payments/sbp", "СБП", "SBP"),
          link("/rating/crypto", "Криптоказино", "Crypto casinos"),
        ],
      },
      {
        title: t("Чёрный список", "Blacklist"),
        items: [link("/rating/blacklist", "Чёрный список", "Blacklist")],
      },
    ],
  },
  {
    id: "bonuses-full",
    path: "/bonuses",
    title: t("Бонусы", "Bonuses"),
    columns: [
      {
        title: t("Бонусы казино", "Casino bonuses"),
        items: [
          link("/bonuses", "Все бонусы", "All bonuses"),
          link("/bonuses/welcome", "Приветственные", "Welcome"),
          link("/bonuses/no-deposit", "Бездепозитные", "No deposit"),
          link("/bonuses/promotions", "Акции", "Promotions"),
          link("/bonuses/free-spins", "Фриспины", "Free spins"),
          link("/bonuses/cashback", "Кэшбэк", "Cashback"),
          link("/bonuses/reload", "Reload-бонусы", "Reload"),
          link("/bonuses/vip", "VIP и лояльность", "VIP & loyalty"),
          link("/bonuses/codes", "Промокоды", "Promo codes"),
        ],
      },
    ],
  },
  {
    id: "slots-full",
    path: "/slots",
    title: t("Игровые автоматы", "Slot machines"),
    columns: [
      {
        title: t("Обзор", "Overview"),
        items: [
          link("/slots", "Все автоматы", "All slots"),
          link("/slots/providers", "Провайдеры", "Providers"),
          link("/slots/new", "Новинки", "New"),
          link("/slots/top-10", "Топ-10", "Top 10"),
          link("/slots/demo", "Демо", "Demo"),
          link("/slots/jackpot", "С джекпотом", "Jackpot"),
          link("/slots/high-rtp", "С высоким RTP", "High RTP"),
        ],
      },
    ],
  },
  {
    id: "poker",
    path: "/poker",
    title: t("Покер-румы", "Poker rooms"),
  },
  {
    id: "more",
    path: "/more",
    title: t("Ещё", "More"),
    columns: [
      {
        title: t("Разделы", "Sections"),
        items: [
          link("/about", "О нас", "About"),
          link("/how-we-earn", "Как мы зарабатываем", "How we earn"),
          link("/methodology", "Методика рейтинга", "Rating method"),
          link("/editorial", "Редполитика / ТЗ", "Editorial / briefs"),
          link("/authors", "Авторы", "Authors"),
          link("/progress", "Прогресс игрока", "Player progress"),
          link("/compare", "Сравнение казино", "Compare casinos"),
          link("/complaints", "Жалобы", "Complaints"),
          link("/contacts", "Контакты", "Contacts"),
          link("/faq", "FAQ", "FAQ"),
          link("/search", "Поиск", "Search"),
          link("/sitemap", "Карта сайта", "Sitemap"),


        ],
      },
    ],
  },
];


/** Flat unique pages for stubs / sitemap (excludes `/` home). */
export function flattenNavLinks(): NavLink[] {
  const map = new Map<string, NavLink>();
  const add = (item: NavLink) => {
    if (item.path === "/" || item.path.startsWith("/legal/"))
      return;
    if (!map.has(item.path))
      map.set(item.path, item);
  };

  for (const section of siteNav) {
    add({ path: section.path, title: section.title });
    for (const col of section.columns ?? []) {
      for (const item of col.items) add(item);
    }
  }
  for (const col of footerNav) {
    for (const item of col.items) add(item);
  }
  add({ path: "/sitemap", title: t("Карта сайта", "Sitemap") });
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function findNavLink(path: string): NavLink | undefined {
  const normalized = path.replace(/\/$/, "") || "/";
  return flattenNavLinks().find(l => l.path === normalized);
}

export function locTitle(text: LocText, locale: string): string {
  return locale.startsWith("en") ? text.en : text.ru;
}

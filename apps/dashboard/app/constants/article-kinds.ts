/** Mirrors @x-reviewer/shared ARTICLE_KINDS (+ legacy) for admin selects. */
export const ARTICLE_KIND_OPTIONS = [
  { value: 'slot-cards', label: 'Карточки слотов · slot-cards' },
  { value: 'providers', label: 'Провайдеры · providers' },
  { value: 'glossary', label: 'Справочник и глоссарий · glossary' },
  { value: 'mechanics-guides', label: 'Гайды по механикам · mechanics-guides' },
  { value: 'news', label: 'Новости · news' },
  { value: 'collections', label: 'Подборки · collections' },
  { value: 'guide', label: 'Обзоры и гайды (legacy) · guide' },
  { value: 'analytics', label: 'Аналитика (legacy) · analytics' },
] as const

export const ARTICLE_KIND_FILTER_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  ...ARTICLE_KIND_OPTIONS,
] as const

export const DEFAULT_ARTICLE_KIND = 'slot-cards'

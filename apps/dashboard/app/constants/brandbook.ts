export interface BrandColor {
  name: string
  token: string
  value: string
  usage: string
}

export interface BrandRadius {
  name: string
  token: string
  value: string
}

export const brandColors: BrandColor[] = [
  { name: 'CTA', token: '--accent-cta', value: '#3dff8a', usage: 'Главные кнопки, успех, акцентные ссылки' },
  { name: 'Violet', token: '--accent-violet', value: '#8b5cff', usage: 'Вторичный акцент, бейджи, highlights' },
  { name: 'Amber', token: '--accent-amber', value: '#f5a524', usage: 'Предупреждения, HOT, осторожно' },
  { name: 'Rose', token: '--accent-rose', value: '#ff4d6d', usage: 'Ошибки, риск, destructive' },
  { name: 'Cyan', token: '--accent-cyan', value: '#3ec7ff', usage: 'Инфо, метрики, charts' },
  { name: 'Gold', token: '--accent-gold', value: '#f0b429', usage: 'Рейтинги, premium' },
]

export const brandSurfaces = [
  { name: 'Canvas', value: '#080b10', token: '--bg-canvas' },
  { name: 'Base', value: '#0d1219', token: '--bg-base' },
  { name: 'Elev 1', value: '#141b24', token: '--bg-elev-1' },
  { name: 'Elev 2', value: '#1a2330', token: '--bg-elev-2' },
  { name: 'Elev 3', value: '#222d3d', token: '--bg-elev-3' },
]

export const brandText = [
  { name: 'Primary', value: '#f3f6fa', token: '--text-primary' },
  { name: 'Secondary', value: '#9aa8b8', token: '--text-secondary' },
  { name: 'Tertiary', value: '#6b7a8c', token: '--text-tertiary' },
]

export const brandRadii: BrandRadius[] = [
  { name: 'XS', token: '--radius-xs', value: '6px' },
  { name: 'SM', token: '--radius-sm', value: '10px' },
  { name: 'MD', token: '--radius-md', value: '14px' },
  { name: 'LG', token: '--radius-lg', value: '20px' },
  { name: 'XL', token: '--radius-xl', value: '28px' },
  { name: 'Pill', token: '--radius-pill', value: '999px' },
]

export const brandFonts = [
  { role: 'Display', family: 'Unbounded', usage: 'Заголовки hero, логотипные акценты' },
  { role: 'UI', family: 'Figtree', usage: 'Интерфейс, body, формы, таблицы' },
]

export const brandPrinciples = [
  {
    title: 'Честность > хайп',
    body: 'Никаких «гарантированных выигрышей» и агрессивного FOMO. Обещания только проверяемые.',
  },
  {
    title: 'Скорость считывания',
    body: 'Карточка казино и листинг должны читаться за 3–5 секунд: рейтинг, бонус, риски, CTA.',
  },
  {
    title: 'Тёмный premium',
    body: 'Тёмный canvas, зелёный CTA, фиолетовый secondary. Светлая тема — производная, не наоборот.',
  },
  {
    title: 'Один акцент на экран',
    body: 'Не конкурируют несколько neon-кнопок. Один primary CTA, остальное — quiet.',
  },
]

export const brandVoice = [
  { do: 'Говорите прямо: «вывод до 24ч», «рейтинг редакции 8.4»', dont: '«Лучшее казино в мире!!!»' },
  { do: 'Помечайте партнёрский контент и HOT как рекламу', dont: 'Прятать affiliate за «независимый топ»' },
  { do: 'Объясняйте риски: вейджер, гео, KYC', dont: 'Скрывать условия в мелком шрифте без саммари' },
]

export const brandComponents = [
  { name: 'Button / Primary', note: 'CTA green, radius-md, сильный hover glow' },
  { name: 'Badge / HOT', note: 'Amber soft fill + label «Реклама» рядом' },
  { name: 'Casino Card', note: 'Лого, rating, short bonus, 2–3 pros, primary CTA' },
  { name: 'Filter chips', note: 'Quiet border, active = CTA soft / violet soft' },
  { name: 'Review block', note: 'Stars + body + date; pending не на сайте' },
]

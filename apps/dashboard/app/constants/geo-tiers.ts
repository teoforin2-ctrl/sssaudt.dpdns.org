/** ISO 3166-1 numeric ids as in world-atlas countries-*.json */

export type GeoTierId
  = | 'tier1'
    | 'tier2'
    | 'tier3'
    | 'caution'
    | 'ban_gambling'
    | 'ban_risk'
    | 'ban_sanctions'

export interface GeoTierMeta {
  id: GeoTierId
  label: string
  short: string
  color: string
  description: string
}

export interface GeoCountryOverride {
  id: string
  name: string
  tier: GeoTierId
  note?: string
}

export const GEO_TIERS: GeoTierMeta[] = [
  {
    id: 'tier1',
    label: 'Tier 1 — приоритет',
    short: 'T1',
    color: '#12b76a',
    description: 'Сильные рынки для контента и партнёрок: регуляция / платёжки / объём.',
  },
  {
    id: 'tier2',
    label: 'Tier 2 — рабочие',
    short: 'T2',
    color: '#3ec7ff',
    description: 'Рабочие гео: есть спрос, но выше нюансы платежей, языка или compliance.',
  },
  {
    id: 'tier3',
    label: 'Tier 3 — прочие',
    short: 'T3',
    color: '#8b5cff',
    description: 'Остальные открытые страны без отдельного приоритета.',
  },
  {
    id: 'caution',
    label: 'Осторожно',
    short: '!',
    color: '#f5a524',
    description: 'Можно работать, но с повышенным вниманием к рискам, платежам и формулировкам.',
  },
  {
    id: 'ban_gambling',
    label: 'Запрет онлайн-гемблинга',
    short: 'Ban',
    color: '#ff4d6d',
    description: 'Юрисдикции с жёстким запретом / блоком онлайн-казино для игроков.',
  },
  {
    id: 'ban_risk',
    label: 'Высокий риск',
    short: 'Risk',
    color: '#e11d48',
    description: 'Высокий AML / security риск. Регистрация и платежи обычно закрыты.',
  },
  {
    id: 'ban_sanctions',
    label: 'Санкции',
    short: 'Sanction',
    color: '#7f1d1d',
    description: 'Санкционные страны и территории. Платформы с игроками оттуда не работают.',
  },
]

/** Explicit overrides; everything else falls back to tier3 */
export const GEO_COUNTRY_OVERRIDES: GeoCountryOverride[] = [
  // Tier 1
  { id: '826', name: 'Великобритания', tier: 'tier1' },
  { id: '276', name: 'Германия', tier: 'tier1' },
  { id: '250', name: 'Франция', tier: 'tier1' },
  { id: '040', name: 'Австрия', tier: 'tier1' },
  { id: '756', name: 'Швейцария', tier: 'tier1' },
  { id: '528', name: 'Нидерланды', tier: 'tier1' },
  { id: '056', name: 'Бельгия', tier: 'tier1' },
  { id: '752', name: 'Швеция', tier: 'tier1' },
  { id: '578', name: 'Норвегия', tier: 'tier1' },
  { id: '246', name: 'Финляндия', tier: 'tier1' },
  { id: '208', name: 'Дания', tier: 'tier1' },
  { id: '372', name: 'Ирландия', tier: 'tier1' },
  { id: '124', name: 'Канада', tier: 'tier1' },
  { id: '036', name: 'Австралия', tier: 'tier1' },
  { id: '554', name: 'Новая Зеландия', tier: 'tier1' },
  { id: '724', name: 'Испания', tier: 'tier1' },
  { id: '380', name: 'Италия', tier: 'tier1' },
  { id: '620', name: 'Португалия', tier: 'tier1' },
  { id: '616', name: 'Польша', tier: 'tier1' },
  { id: '203', name: 'Чехия', tier: 'tier1' },

  // Tier 2
  { id: '076', name: 'Бразилия', tier: 'tier2' },
  { id: '484', name: 'Мексика', tier: 'tier2' },
  { id: '032', name: 'Аргентина', tier: 'tier2' },
  { id: '152', name: 'Чили', tier: 'tier2' },
  { id: '170', name: 'Колумбия', tier: 'tier2' },
  { id: '604', name: 'Перу', tier: 'tier2' },
  { id: '356', name: 'Индия', tier: 'tier2' },
  { id: '392', name: 'Япония', tier: 'tier2' },
  { id: '410', name: 'Южная Корея', tier: 'tier2' },
  { id: '710', name: 'ЮАР', tier: 'tier2' },
  { id: '792', name: 'Турция', tier: 'tier2' },
  { id: '784', name: 'ОАЭ', tier: 'tier2' },
  { id: '642', name: 'Румыния', tier: 'tier2' },
  { id: '348', name: 'Венгрия', tier: 'tier2' },
  { id: '300', name: 'Греция', tier: 'tier2' },
  { id: '703', name: 'Словакия', tier: 'tier2' },
  { id: '191', name: 'Хорватия', tier: 'tier2' },
  { id: '100', name: 'Болгария', tier: 'tier2' },
  { id: '688', name: 'Сербия', tier: 'tier2' },
  { id: '804', name: 'Украина', tier: 'tier2', note: 'Материковая часть. Крым / ДНР / ЛНР — в санкционном списке отдельно.' },
  { id: '398', name: 'Казахстан', tier: 'tier2' },
  { id: '860', name: 'Узбекистан', tier: 'tier2' },
  { id: '268', name: 'Грузия', tier: 'tier2' },
  { id: '051', name: 'Армения', tier: 'tier2' },
  { id: '031', name: 'Азербайджан', tier: 'tier2' },
  { id: '498', name: 'Молдова', tier: 'tier2' },

  // Caution — Россия можно, но осторожно
  {
    id: '643',
    name: 'Россия',
    tier: 'caution',
    note: 'Работа возможна, но с осторожностью: платежи, формулировки, партнёрские оферы и compliance.',
  },

  // Gambling ban
  { id: '840', name: 'США', tier: 'ban_gambling', note: 'Вкл. Пуэрто-Рико, Гуам, Виргинские острова (на карте как часть США).' },
  { id: '156', name: 'Китай', tier: 'ban_gambling' },
  { id: '344', name: 'Гонконг', tier: 'ban_gambling' },
  { id: '446', name: 'Макао', tier: 'ban_gambling' },
  { id: '702', name: 'Сингапур', tier: 'ban_gambling' },
  { id: '608', name: 'Филиппины', tier: 'ban_gambling' },

  // High risk
  { id: '004', name: 'Афганистан', tier: 'ban_risk' },
  { id: '368', name: 'Ирак', tier: 'ban_risk' },
  { id: '434', name: 'Ливия', tier: 'ban_risk' },
  { id: '729', name: 'Судан', tier: 'ban_risk' },
  { id: '728', name: 'Южный Судан', tier: 'ban_risk' },
  { id: '887', name: 'Йемен', tier: 'ban_risk' },
  { id: '706', name: 'Сомали', tier: 'ban_risk' },

  // Sanctions
  { id: '408', name: 'КНДР', tier: 'ban_sanctions' },
  { id: '364', name: 'Иран', tier: 'ban_sanctions' },
  { id: '760', name: 'Сирия', tier: 'ban_sanctions' },
  { id: '192', name: 'Куба', tier: 'ban_sanctions' },
  { id: '104', name: 'Мьянма', tier: 'ban_sanctions' },
  { id: '112', name: 'Беларусь', tier: 'ban_sanctions' },
  { id: '862', name: 'Венесуэла', tier: 'ban_sanctions' },
]

export const GEO_TERRITORY_NOTES: { title: string, tier: GeoTierId, items: string[] }[] = [
  {
    title: 'Санкционные территории (не отдельные страны на карте)',
    tier: 'ban_sanctions',
    items: ['Крым', 'Донецкая область Украины', 'Луганская область Украины'],
  },
  {
    title: 'Территории США (запрет онлайн-гемблинга)',
    tier: 'ban_gambling',
    items: ['Пуэрто-Рико', 'Гуам', 'Виргинские острова США'],
  },
]

export const GEO_RESTRICTED_GROUPS = [
  {
    id: 'ban_sanctions',
    title: 'Санкционные',
    icon: '⛔️',
    items: ['КНДР', 'Иран', 'Сирия', 'Куба', 'Мьянма', 'Беларусь', 'Венесуэла', 'Крым', 'Донецкая и Луганская области Украины'],
  },
  {
    id: 'ban_risk',
    title: 'Высокий риск',
    icon: '⛔️',
    items: ['Афганистан', 'Ирак', 'Ливия', 'Судан', 'Южный Судан', 'Йемен', 'Сомали'],
  },
  {
    id: 'ban_gambling',
    title: 'Запрет онлайн-гемблинга',
    icon: '⛔️',
    items: ['США (вкл. Пуэрто-Рико, Гуам, Виргинские острова)', 'Китай', 'Гонконг', 'Макао', 'Сингапур', 'Филиппины'],
  },
  {
    id: 'caution',
    title: 'Осторожно (не бан)',
    icon: '⚠️',
    items: ['Россия — можно, но осторожно'],
  },
] as const

const overrideById = new Map(GEO_COUNTRY_OVERRIDES.map(c => [normalizeId(c.id), c]))

export function normalizeId(id: string | number | undefined | null) {
  if (id == null)
    return ''
  return String(id).padStart(3, '0')
}

export function tierMeta(id: GeoTierId) {
  return GEO_TIERS.find(t => t.id === id) || GEO_TIERS[2]!
}

export function resolveCountryTier(id: string | number | undefined | null): GeoCountryOverride {
  const nid = normalizeId(id)
  const hit = overrideById.get(nid)
  if (hit)
    return hit
  return {
    id: nid,
    name: `Country ${nid || '?'}`,
    tier: 'tier3',
  }
}

export function isRestrictedTier(tier: GeoTierId) {
  return tier === 'ban_gambling' || tier === 'ban_risk' || tier === 'ban_sanctions'
}

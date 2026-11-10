-- Phase 1 (lean) schema for Phase 3 home blocks. Expand seed later to full volumes.

create table if not exists game_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description_ru text,
  description_en text,
  status text not null default 'published'
);

create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  provider_id uuid references game_providers(id) on delete set null,
  theme text not null default 'fruits',
  mechanics text[] not null default '{}',
  release_date date,
  rtp numeric(4,1),
  volatility text not null default 'medium',
  grid text,
  description_ru text,
  description_en text,
  demo_url text,
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists slot_casinos (
  slot_id uuid not null references slots(id) on delete cascade,
  casino_id uuid not null references casinos(id) on delete cascade,
  bonus_id uuid,
  primary key (slot_id, casino_id)
);

create table if not exists authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  role_ru text,
  role_en text,
  bio_ru text,
  bio_en text,
  hue int not null default 160,
  is_seed boolean not null default true,
  quote_ru text,
  quote_en text
);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null default 'guide',
  topic text,
  title_ru text not null,
  title_en text not null,
  excerpt_ru text,
  excerpt_en text,
  body_md_ru text,
  body_md_en text,
  author_id uuid references authors(id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cover_theme text not null default 'guide',
  reading_minutes int not null default 5,
  status text not null default 'published'
);

create table if not exists partner_brands (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  slug text not null unique,
  name text not null,
  tagline_ru text,
  tagline_en text,
  bonus_text_ru text,
  bonus_text_en text,
  rating numeric(3,1) not null default 4.5,
  details jsonb not null default '{}',
  partner_url text,
  has_representative boolean not null default false,
  has_hot boolean not null default false,
  status text not null default 'published'
);

create table if not exists promo_banners (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid references casinos(id) on delete set null,
  bonus_id uuid,
  title_ru text not null,
  title_en text not null,
  valid_until timestamptz,
  theme text not null default 'amber',
  active boolean not null default true
);

-- Seed providers
insert into game_providers (slug, name, description_ru, description_en, status) values
  ('nova-gaming', 'NovaGaming', 'Студия слотов с упором на понятные механики.', 'Slot studio focused on clear mechanics.', 'published'),
  ('pixel-reels', 'PixelReels', 'Яркие видеослоты и кластерные сетки.', 'Bright video slots and cluster grids.', 'published'),
  ('northwind-studio', 'Northwind Studio', 'Северная эстетика и hold-and-win.', 'Northern look and hold-and-win features.', 'published'),
  ('amber-labs', 'Amber Labs', 'Эксперименты с RTP-вариантами.', 'Experiments with RTP variants.', 'published')
on conflict (slug) do nothing;

-- Seed slots (16)
with p as (select id, slug from game_providers),
v(slug, title, pslug, theme, mechanics, release_date, rtp, volatility, grid, description_ru, description_en, status) as (
  values
  ('solar-scarab', 'Solar Scarab', 'nova-gaming', 'egypt', array['bonus-buy']::text[], current_date - 10, 96.4, 'high', '5x3', 'Египетский слот с бонус-покупкой.', 'Egyptian slot with bonus buy.', 'published'),
  ('berry-cascade', 'Berry Cascade', 'pixel-reels', 'fruits', array['cascade']::text[], current_date - 20, 96.1, 'medium', '6x5', 'Фруктовый каскад.', 'Fruit cascade.', 'published'),
  ('reef-hook', 'Reef Hook', 'northwind-studio', 'fishing', array['hold-and-win']::text[], current_date - 5, 95.8, 'medium', '5x3', 'Рыбалка hold-and-win.', 'Fishing hold-and-win.', 'published'),
  ('olympus-bolt', 'Olympus Bolt', 'nova-gaming', 'mythology', array['megaways']::text[], current_date - 30, 96.7, 'very-high', '6x6', 'Мифология megaways.', 'Mythology megaways.', 'published'),
  ('candy-orbit', 'Candy Orbit', 'pixel-reels', 'sweets', array['cluster']::text[], current_date - 12, 96.2, 'low', '7x7', 'Сладости cluster.', 'Sweets cluster.', 'published'),
  ('cactus-gold', 'Cactus Gold', 'amber-labs', 'wild-west', array['jackpot']::text[], current_date - 40, 95.5, 'high', '5x3', 'Дикий Запад jackpot.', 'Wild West jackpot.', 'published'),
  ('ringed-planet', 'Ringed Planet', 'nova-gaming', 'space', array['megaways','bonus-buy']::text[], current_date - 8, 97.0, 'high', '6x5', 'Космос megaways.', 'Space megaways.', 'published'),
  ('koi-lantern', 'Koi Lantern', 'northwind-studio', 'asian', array['hold-and-win']::text[], current_date - 15, 96.0, 'medium', '5x3', 'Азиатский hold-and-win.', 'Asian hold-and-win.', 'published'),
  ('tome-of-runes', 'Tome of Runes', 'amber-labs', 'books', array['bonus-buy']::text[], current_date - 60, 96.3, 'high', '5x3', 'Книжный слот.', 'Book-style slot.', 'published'),
  ('vault-raid', 'Vault Raid', 'pixel-reels', 'treasure', array['hold-and-win','jackpot']::text[], current_date - 25, 95.9, 'high', '5x3', 'Сокровища.', 'Treasure raid.', 'published'),
  ('neon-mango', 'Neon Mango', 'pixel-reels', 'fruits', array['cascade']::text[], current_date - 3, 96.8, 'low', '5x3', 'Неоновые фрукты.', 'Neon fruits.', 'published'),
  ('sand-oracle', 'Sand Oracle', 'nova-gaming', 'egypt', array['megaways']::text[], current_date - 18, 96.5, 'medium', '6x5', 'Пески megaways.', 'Desert megaways.', 'published'),
  ('frost-nets', 'Frost Nets', 'northwind-studio', 'fishing', array['hold-and-win']::text[], current_date - 70, 95.7, 'medium', '5x3', 'Северная рыбалка.', 'Northern fishing.', 'published'),
  ('myth-spark', 'Myth Spark', 'amber-labs', 'mythology', array['bonus-buy']::text[], current_date - 90, 96.1, 'high', '5x3', 'Мифы и бонус-бай.', 'Myths and bonus buy.', 'published'),
  ('jelly-storm', 'Jelly Storm', 'pixel-reels', 'sweets', array['cluster']::text[], current_date - 2, 96.6, 'low', '6x6', 'Желейный шторм.', 'Jelly storm.', 'published'),
  ('comet-chest', 'Comet Chest', 'nova-gaming', 'space', array['jackpot']::text[], current_date - 35, 95.4, 'very-high', '5x3', 'Космический сундук.', 'Space chest.', 'published')
)
insert into slots (slug, title, provider_id, theme, mechanics, release_date, rtp, volatility, grid, description_ru, description_en, status)
select v.slug, v.title, p.id, v.theme, v.mechanics, v.release_date, v.rtp, v.volatility, v.grid, v.description_ru, v.description_en, v.status
from v
join p on p.slug = v.pslug
on conflict (slug) do nothing;

-- Authors
insert into authors (slug, name, role_ru, role_en, bio_ru, bio_en, hue, is_seed, quote_ru, quote_en) values
  ('mira-volkova', 'Mira Volkova', 'Главный редактор', 'Editor-in-chief', 'Проверяет методологию рейтинга.', 'Owns ranking methodology.', 168, true,
   'Мы сверяем условия бонусов с датой проверки и не обещаем выигрыш.',
   'We timestamp bonus checks and never promise wins.'),
  ('ivan-reed', 'Ivan Reed', 'Редактор бонусов', 'Bonuses editor', 'Следит за вейджером и сроками.', 'Tracks wager and terms.', 210, true, null, null),
  ('sofia-lane', 'Sofia Lane', 'Редактор слотов', 'Slots editor', 'Описывает механики нейтрально.', 'Describes mechanics neutrally.', 280, true, null, null),
  ('kai-orn', 'Kai Orn', 'Юридический редактор', 'Legal editor', 'Сверяет дисклеймеры.', 'Reviews disclaimers.', 40, true, null, null)
on conflict (slug) do nothing;

-- Articles
with a as (select id, slug from authors)
insert into articles (slug, kind, topic, title_ru, title_en, excerpt_ru, excerpt_en, author_id, cover_theme, reading_minutes, status)
select v.slug, v.kind, v.topic, v.title_ru, v.title_en, v.excerpt_ru, v.excerpt_en, a.id, v.cover_theme, v.reading_minutes, 'published'
from (values
  ('how-to-choose-casino', 'guide', 'basics', 'Как выбрать онлайн-казино', 'How to choose an online casino', 'Чеклист лицензии, выплат и бонусов.', 'Checklist for license, payouts and bonuses.', 'mira-volkova', 'guide', 12),
  ('how-slots-work', 'guide', 'slots', 'Как работают слоты', 'How slots work', 'RTP, волатильность и дистанция.', 'RTP, volatility and long-run play.', 'sofia-lane', 'guide', 11),
  ('wager-basics', 'guide', 'terms', 'Что такое вейджер', 'What wagering means', 'Простыми словами про отыгрыш.', 'Wagering explained simply.', 'ivan-reed', 'guide', 6),
  ('first-deposit-checklist', 'guide', 'getting-started', 'Чеклист первого депозита', 'First deposit checklist', 'Перед пополнением проверьте лимиты.', 'Check limits before depositing.', 'ivan-reed', 'guide', 5),
  ('table-games-start', 'guide', 'table-games', 'С чего начать настольные', 'Starting with table games', 'Блэкджек и рулетка без мифов.', 'Blackjack and roulette without myths.', 'sofia-lane', 'guide', 7),
  ('live-basics', 'guide', 'live', 'Live-казино: база', 'Live casino basics', 'Задержки, лимиты, этикет.', 'Latency, limits, etiquette.', 'sofia-lane', 'guide', 6),
  ('bankroll-simple', 'guide', 'strategies', 'Банкролл без иллюзий', 'Bankroll without illusions', 'Лимиты сессии и паузы.', 'Session limits and breaks.', 'mira-volkova', 'guide', 8),
  ('bonus-types', 'guide', 'bonuses', 'Типы бонусов', 'Bonus types', 'Приветственные, FS, кешбэк.', 'Welcome, FS, cashback.', 'ivan-reed', 'guide', 7),
  ('useful-tools', 'guide', 'useful', 'Полезные инструменты игрока', 'Useful player tools', 'История ставок и самоограничения.', 'Bet history and self-limits.', 'kai-orn', 'guide', 5),
  ('rtp-distance', 'analytics', null, 'RTP считается на дистанции', 'RTP is a long-run metric', 'Короткий разбор дисперсии.', 'Short note on variance.', 'sofia-lane', 'analytics', 8),
  ('megaways-notes', 'analytics', null, 'Заметки о Megaways', 'Megaways notes', 'Что меняется в сетке.', 'What changes in the grid.', 'sofia-lane', 'analytics', 7),
  ('week-in-bonuses', 'news', null, 'Что проверить в бонусах на этой неделе', 'Bonus checks this week', 'Обновили даты проверки у части офферов.', 'Updated checked dates on some offers.', 'ivan-reed', 'news', 4)
) as v(slug, kind, topic, title_ru, title_en, excerpt_ru, excerpt_en, author_slug, cover_theme, reading_minutes)
join a on a.slug = v.author_slug
on conflict (slug) do nothing;

-- Partner brands (3 per kind)
insert into partner_brands (kind, slug, name, tagline_ru, tagline_en, bonus_text_ru, bonus_text_en, rating, details, partner_url, has_hot, has_representative, status) values
  ('poker-room', 'riverfold', 'Riverfold Poker', 'Турниры и кэш', 'Tournaments & cash', 'Пакет для новичков', 'Newcomer pack', 4.7, '{"features":["sit-and-go","rakeback"]}', 'https://example.com/riverfold', true, false, 'published'),
  ('poker-room', 'oaktable', 'Oak Table', 'Медленные столы', 'Slow tables', 'Рейкбек-неделя', 'Rakeback week', 4.5, '{"features":["spins"]}', 'https://example.com/oaktable', false, true, 'published'),
  ('poker-room', 'northblind', 'North Blind', 'МТТ-фокус', 'MTT focus', 'Билет в сателлит', 'Satellite ticket', 4.6, '{"features":["mtt"]}', 'https://example.com/northblind', false, false, 'published'),
  ('bookmaker', 'linewise', 'Linewise', 'Линии без шума', 'Clean lines', 'Фрибет после верификации', 'Free bet after KYC', 4.6, '{"features":["live","esports"]}', 'https://example.com/linewise', true, false, 'published'),
  ('bookmaker', 'goalmeter', 'Goalmeter', 'Футбольный уклон', 'Football focus', 'Буст на экспресс', 'Acca boost', 4.4, '{"features":["football"]}', 'https://example.com/goalmeter', false, false, 'published'),
  ('bookmaker', 'iceodd', 'IceOdd', 'Хоккей и кибер', 'Hockey & esports', 'Кешбэк на неделю', 'Weekly cashback', 4.5, '{"features":["hockey"]}', 'https://example.com/iceodd', false, true, 'published'),
  ('land-casino', 'amber-hall', 'Amber Hall', 'Зал у набережной', 'Waterfront hall', null, null, 4.8, '{"city":"Tallinn","country":"Estonia","features":["live music","poker room"]}', null, false, false, 'published'),
  ('land-casino', 'copper-room', 'Copper Room', 'Клубный формат', 'Club format', null, null, 4.3, '{"city":"Riga","country":"Latvia","features":["roulette","vip"]}', null, false, false, 'published'),
  ('land-casino', 'north-dice', 'North Dice', '24/7 зал', '24/7 floor', null, null, 4.4, '{"city":"Helsinki","country":"Finland","features":["slots"]}', null, true, false, 'published'),
  ('affiliate-program', 'revshare-nest', 'RevShare Nest', 'Гибкий ревшар', 'Flexible revshare', 'До 40% revshare', 'Up to 40% revshare', 4.5, '{"model":"RevShare","payout_note":"Net-30"}', 'https://example.com/revshare-nest', false, false, 'published'),
  ('affiliate-program', 'cpa-orbit', 'CPA Orbit', 'CPA по гео', 'Geo CPA', 'CPA от $80', 'CPA from $80', 4.2, '{"model":"CPA","payout_note":"Weekly"}', 'https://example.com/cpa-orbit', true, false, 'published'),
  ('affiliate-program', 'hybrid-lane', 'Hybrid Lane', 'Гибрид', 'Hybrid deals', 'RevShare + CPA', 'RevShare + CPA', 4.6, '{"model":"Hybrid","payout_note":"Net-15"}', 'https://example.com/hybrid-lane', false, true, 'published')
on conflict (slug) do nothing;

-- Promo banners (relative to now); skip if any active already exist
insert into promo_banners (casino_id, title_ru, title_en, valid_until, theme, active)
select c.id,
  '120 FS и 100% у ' || coalesce(c.name_ru, c.name),
  '120 FS and 100% at ' || coalesce(c.name_en, c.name),
  now() + interval '20 hours',
  'amber',
  true
from casinos c
where c.status = 'published'
  and not exists (select 1 from promo_banners where active = true)
order by c.hot desc, c.final_rating desc nulls last
limit 1;

insert into promo_banners (casino_id, title_ru, title_en, valid_until, theme, active)
select c.id,
  'Кешбэк 10% у ' || coalesce(c.name_ru, c.name),
  '10% cashback at ' || coalesce(c.name_en, c.name),
  now() + interval '5 days',
  'mint',
  true
from casinos c
where c.status = 'published'
  and (select count(*) from promo_banners where active = true) < 2
order by c.final_rating desc nulls last
offset 1 limit 1;

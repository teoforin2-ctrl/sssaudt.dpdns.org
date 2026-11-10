-- Seed payment methods / providers / casinos / bonuses

insert into payment_methods (code, name_ru, name_en) values
  ('visa', 'Visa', 'Visa'),
  ('mastercard', 'Mastercard', 'Mastercard'),
  ('sbp', 'СБП', 'SBP'),
  ('btc', 'Bitcoin', 'Bitcoin'),
  ('usdt', 'USDT', 'USDT'),
  (' eth', 'Ethereum', 'Ethereum')
on conflict (code) do nothing;

-- fix accidental space in eth code if inserted wrong
delete from payment_methods where code = ' eth';
insert into payment_methods (code, name_ru, name_en) values
  ('eth', 'Ethereum', 'Ethereum')
on conflict (code) do nothing;

insert into providers (code, name) values
  ('pragmatic', 'Pragmatic Play'),
  ('netent', 'NetEnt'),
  ('playngo', 'Play''n GO'),
  ('evolution', 'Evolution'),
  ('bgaming', 'BGaming')
on conflict (code) do nothing;

-- upsert casinos by slug
with data(slug, name, name_ru, name_en, logo, license, editorial, hot, partner, has_rep, short_ru, short_en, platforms, countries) as (
  values
  ('pokerdom', 'Pokerdom', 'Pokerdom', 'Pokerdom', '/logos/pokerdom.svg', 'Curacao', 4.8, true, 'https://example.com/pokerdom', true, 'Лидер по бонусам и live', 'Top bonuses and live casino', '{web,ios,android}'::text[], '{RU,KZ,UZ}'::text[]),
  ('vavada', 'Vavada', 'Vavada', 'Vavada', '/logos/vavada.svg', 'Curacao', 4.6, true, 'https://example.com/vavada', false, 'Быстрые выводы и крипта', 'Fast payouts and crypto', '{web,android}'::text[], '{RU,UA,KZ}'::text[]),
  ('1xslots', '1xSlots', '1xSlots', '1xSlots', '/logos/1xslots.svg', 'Curacao', 4.4, false, 'https://example.com/1xslots', true, 'Большой каталог слотов', 'Huge slots catalogue', '{web,ios,android}'::text[], '{RU,BY,KZ}'::text[]),
  ('pinup', 'Pin-Up', 'Pin-Up', 'Pin-Up', '/logos/pinup.svg', 'Curacao', 4.3, false, 'https://example.com/pinup', false, 'Спорт + казино', 'Sports + casino', '{web,ios}'::text[], '{AZ,KZ,UZ}'::text[]),
  ('stake', 'Stake', 'Stake', 'Stake', '/logos/stake.svg', 'Curacao', 4.7, true, 'https://example.com/stake', true, 'Крипто-first казино', 'Crypto-first casino', '{web,ios,android}'::text[], '{GLOBAL}'::text[]),
  ('roobet', 'Roobet', 'Roobet', 'Roobet', '/logos/roobet.svg', 'Curacao', 4.2, false, 'https://example.com/roobet', false, 'Оригинальные crash-игры', 'Original crash games', '{web}'::text[], '{GLOBAL}'::text[]),
  ('bcgame', 'BC.Game', 'BC.Game', 'BC.Game', '/logos/bcgame.svg', 'Curacao', 4.1, false, 'https://example.com/bcgame', false, 'Крипта и лотереи', 'Crypto and lotteries', '{web,android}'::text[], '{GLOBAL}'::text[]),
  ('bitcasino', 'Bitcasino', 'Bitcasino', 'Bitcasino', '/logos/bitcasino.svg', 'MGA', 4.5, false, 'https://example.com/bitcasino', true, 'Премиум live и BTC', 'Premium live and BTC', '{web,ios}'::text[], '{EU}'::text[])
)
insert into casinos (
  slug, name, name_ru, name_en, logo_url, license,
  editorial_score, hot, partner_url, has_representative,
  short_desc_ru, short_desc_en, platforms, countries_allowed,
  languages, status, published, base_rating, final_rating, player_score
)
select
  d.slug, d.name, d.name_ru, d.name_en, d.logo, d.license,
  d.editorial, d.hot, d.partner, d.has_rep,
  d.short_ru, d.short_en, d.platforms, d.countries,
  '{ru,en}'::text[], 'published', true,
  d.editorial,
  d.editorial + case when d.hot then 1 else 0 end,
  null
from data d
on conflict (slug) do update set
  name = excluded.name,
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  logo_url = excluded.logo_url,
  license = excluded.license,
  editorial_score = excluded.editorial_score,
  hot = excluded.hot,
  partner_url = excluded.partner_url,
  has_representative = excluded.has_representative,
  short_desc_ru = excluded.short_desc_ru,
  short_desc_en = excluded.short_desc_en,
  platforms = excluded.platforms,
  countries_allowed = excluded.countries_allowed,
  status = 'published',
  published = true,
  base_rating = excluded.base_rating,
  final_rating = excluded.final_rating,
  updated_at = now();

-- link payments / providers (sample)
insert into casino_payment_methods (casino_id, payment_method_id)
select c.id, p.id
from casinos c
cross join payment_methods p
where c.slug in ('pokerdom','vavada','stake','bitcasino')
  and p.code in ('visa','mastercard','btc','usdt')
on conflict do nothing;

insert into casino_providers (casino_id, provider_id)
select c.id, p.id
from casinos c
cross join providers p
where c.slug in ('pokerdom','vavada','1xslots','stake')
  and p.code in ('pragmatic','evolution','playngo')
on conflict do nothing;

-- bonuses
insert into bonuses (
  casino_id, title, title_ru, title_en, promo_code, type,
  amount_or_percent, percent_value, is_percent_deposit, wager,
  status, published, source, checked_by_editor
)
select c.id,
  'Welcome 100%', 'Приветственный 100%', 'Welcome 100%',
  'WELCOME100', 'welcome', '100%', 100, true, 'x35',
  'active', true, 'manual_editor', true
from casinos c where c.slug = 'pokerdom'
and not exists (
  select 1 from bonuses b where b.casino_id = c.id and b.promo_code = 'WELCOME100'
);

insert into bonuses (
  casino_id, title, title_ru, title_en, promo_code, type,
  amount_or_percent, percent_value, is_percent_deposit, wager,
  status, published, source, checked_by_editor
)
select c.id,
  'Crypto boost 50%', 'Крипто-бонус 50%', 'Crypto boost 50%',
  'CRYPTO50', 'reload', '50%', 50, true, 'x30',
  'active', true, 'manual_editor', true
from casinos c where c.slug = 'stake'
and not exists (
  select 1 from bonuses b where b.casino_id = c.id and b.promo_code = 'CRYPTO50'
);

insert into bonuses (
  casino_id, title, title_ru, title_en, promo_code, type,
  amount_or_percent, percent_value, is_percent_deposit, wager,
  status, published, source, checked_by_editor
)
select c.id,
  'FS pack 50', '50 фриспинов', '50 free spins',
  'FS50', 'freespins', '50 FS', null, false, 'x40',
  'active', true, 'manual_partner', true
from casinos c where c.slug = 'vavada'
and not exists (
  select 1 from bonuses b where b.casino_id = c.id and b.promo_code = 'FS50'
);

insert into bonuses (
  casino_id, title, title_ru, title_en, promo_code, type,
  amount_or_percent, percent_value, is_percent_deposit, wager,
  status, published, source, checked_by_editor
)
select c.id,
  'Deposit 120%', 'Депозит +120%', 'Deposit +120%',
  'PINUP120', 'welcome', '120%', 120, true, 'x40',
  'active', true, 'manual_editor', true
from casinos c where c.slug = 'pinup'
and not exists (
  select 1 from bonuses b where b.casino_id = c.id and b.promo_code = 'PINUP120'
);

-- demo admin user (password placeholder — auth stub later)
insert into users (email, display_name, role_id, password_hash)
select 'admin@casino-review.local', 'Admin', r.id, 'stub'
from roles r where r.code = 'admin'
on conflict (email) do nothing;

insert into users (email, display_name, role_id, password_hash)
select 'editor@casino-review.local', 'Editor', r.id, 'stub'
from roles r where r.code = 'editor'
on conflict (email) do nothing;

insert into users (email, display_name, role_id, password_hash, casino_id)
select 'partner@pokerdom.local', 'Pokerdom Rep', r.id, 'stub', c.id
from roles r
cross join casinos c
where r.code = 'partner_rep' and c.slug = 'pokerdom'
on conflict (email) do update set casino_id = excluded.casino_id;

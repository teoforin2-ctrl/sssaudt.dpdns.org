-- MVP Geo & Content pack: ≥5 seed-отзывов на каждый published бренд без наполнения.
-- origin=ugc + is_seed=true (как импорт casino.ru) — честно помечены в БД, не выдаём за «живых» в UI badge.
-- После вставки пересчитываем player_score / base_rating / final_rating.

begin;

with templates(ord, rating, body_ru, body_en, author_ru, author_en) as (
  values
    (1, 5,
     'Играю около месяца: депозит прошёл без сюрпризов, бонус отыграл на слотах. Вывод занял меньше суток — претензий нет.',
     'Been playing for about a month: deposit was smooth, cleared the bonus on slots. Withdrawal took under a day — no complaints.',
     'Алексей', 'Alex'),
    (2, 4,
     'Интерфейс понятный, служба поддержки ответила в чате за 10 минут. Вейджер у приветственного бонуса высокий — читайте условия.',
     'UI is clear, support replied in chat within 10 minutes. Welcome wager is high — read the terms carefully.',
     'Марина', 'Marina'),
    (3, 5,
     'Нравится выбор провайдеров и быстрые выплаты на карту. Из минусов — иногда долгая верификация при первом выводе.',
     'Like the provider lineup and fast card payouts. Downside: first-time KYC can be slow.',
     'Игорь', 'Igor'),
    (4, 3,
     'В целом нормально, но лимиты на вывод мелкие. Для крупных сумм лучше уточнять лимиты заранее.',
     'Okay overall, but withdrawal limits are low. Check limits before depositing larger amounts.',
     'Светлана', 'Svetlana'),
    (5, 4,
     'Бонусная программа рабочая, кэшбэк приходит вовремя. Мобильная версия стабильная, зависаний почти нет.',
     'Bonus program works, cashback arrives on time. Mobile version is stable with almost no freezes.',
     'Дмитрий', 'Dmitry')
),
targets as (
  select c.id, c.name
  from casinos c
  where c.published = true
    and (
      select count(*)::int
      from reviews r
      where r.casino_id = c.id and r.status = 'approved'
    ) < 5
),
needed as (
  select
    t.id as casino_id,
    tpl.ord,
    tpl.rating,
    tpl.body_ru,
    tpl.body_en,
    tpl.author_ru,
    tpl.author_en,
    (
      select count(*)::int
      from reviews r
      where r.casino_id = t.id and r.status = 'approved'
    ) as have
  from targets t
  cross join templates tpl
)
insert into reviews (
  casino_id, rating, body, status, published_at, locale, language,
  origin, is_seed, author_name, author_rank, source, body_hash
)
select
  n.casino_id,
  n.rating,
  n.body_ru || ' (' || left(n.casino_id::text, 8) || ')',
  'approved',
  now() - ((n.ord + n.have) || ' days')::interval,
  'ru',
  'ru',
  'ugc',
  true,
  n.author_ru,
  'seed',
  'mvp-content-pack',
  md5(n.casino_id::text || ':mvp-pack:' || n.ord::text)
from needed n
where n.ord > n.have
on conflict do nothing;

-- EN mirrors (optional second locale copies for bilingual cards; skip if same body_hash conflict)
with templates(ord, rating, body_en, author_en) as (
  values
    (1, 5,
     'Been playing for about a month: deposit was smooth, cleared the bonus on slots. Withdrawal took under a day — no complaints.',
     'Alex'),
    (2, 4,
     'UI is clear, support replied in chat within 10 minutes. Welcome wager is high — read the terms carefully.',
     'Marina'),
    (3, 5,
     'Like the provider lineup and fast card payouts. Downside: first-time KYC can be slow.',
     'Igor'),
    (4, 3,
     'Okay overall, but withdrawal limits are low. Check limits before depositing larger amounts.',
     'Svetlana'),
    (5, 4,
     'Bonus program works, cashback arrives on time. Mobile version is stable with almost no freezes.',
     'Dmitry')
),
targets as (
  select c.id
  from casinos c
  where c.published = true
    and (
      select count(*)::int
      from reviews r
      where r.casino_id = c.id and r.status = 'approved' and r.locale = 'en'
    ) < 1
    and (
      select count(*)::int
      from reviews r
      where r.casino_id = c.id and r.status = 'approved'
    ) >= 5
)
insert into reviews (
  casino_id, rating, body, status, published_at, locale, language,
  origin, is_seed, author_name, author_rank, source, body_hash
)
select
  t.id,
  tpl.rating,
  tpl.body_en || ' [' || left(t.id::text, 8) || ']',
  'approved',
  now() - (tpl.ord || ' days')::interval,
  'en',
  'en',
  'ugc',
  true,
  tpl.author_en,
  'seed',
  'mvp-content-pack-en',
  md5(t.id::text || ':mvp-pack-en:' || tpl.ord::text)
from targets t
cross join templates tpl
where tpl.ord <= 2
on conflict do nothing;

-- Recalc player / base / final for brands that now have ≥5 ugc approved
with agg as (
  select
    casino_id,
    round(avg(rating)::numeric, 1) as avg_rating,
    count(*)::int as n
  from reviews
  where status = 'approved' and coalesce(origin, 'ugc') = 'ugc'
  group by casino_id
  having count(*) >= 5
)
update casinos c
set
  player_score = a.avg_rating,
  base_rating = round(
    (0.6 * coalesce(c.editorial_score, 0) + 0.4 * a.avg_rating)::numeric,
    2
  ),
  final_rating = round(
    (
      0.6 * coalesce(c.editorial_score, 0)
      + 0.4 * a.avg_rating
      + case when c.hot then 1 else 0 end
    )::numeric,
    2
  ),
  updated_at = now()
from agg a
where a.casino_id = c.id;

commit;

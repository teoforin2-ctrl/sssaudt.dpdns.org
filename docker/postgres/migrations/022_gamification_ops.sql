-- P3 gamification (player levels / achievements) + exclusive promo pool

create table if not exists player_progress (
  player_id uuid primary key references players(id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  level int not null default 1 check (level >= 1),
  reviews_approved int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists achievements (
  id text primary key,
  title_ru text not null,
  title_en text not null,
  description_ru text not null default '',
  description_en text not null default '',
  xp_reward int not null default 0,
  icon text not null default 'star',
  sort_order int not null default 0
);

create table if not exists player_achievements (
  player_id uuid not null references players(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, achievement_id)
);

create index if not exists player_achievements_player_idx on player_achievements(player_id);

insert into achievements (id, title_ru, title_en, description_ru, description_en, xp_reward, icon, sort_order) values
  ('first_review', 'Первый отзыв', 'First review', 'Опубликован первый отзыв', 'Published your first review', 50, 'pen', 10),
  ('reviews_5', 'Голос сообщества', 'Community voice', '5 одобренных отзывов', '5 approved reviews', 100, 'megaphone', 20),
  ('reviews_20', 'Эксперт площадки', 'Platform expert', '20 одобренных отзывов', '20 approved reviews', 250, 'badge', 30),
  ('high_quality', 'Качественный контент', 'Quality writer', 'Отзыв с AI score ≥ 80', 'A review with AI score ≥ 80', 75, 'sparkles', 40),
  ('level_5', 'Уровень 5', 'Level 5', 'Достигнут 5 уровень', 'Reached level 5', 0, 'trophy', 50)
on conflict (id) do nothing;

create table if not exists exclusive_promos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_ru text not null,
  title_en text not null,
  casino_id uuid references casinos(id) on delete set null,
  min_level int not null default 1,
  max_claims int,
  claims_count int not null default 0,
  active boolean not null default true,
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists exclusive_promo_claims (
  promo_id uuid not null references exclusive_promos(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (promo_id, player_id)
);

-- Seed a couple of exclusive codes (demo)
insert into exclusive_promos (code, title_ru, title_en, min_level, max_claims, active)
values
  ('SSAUDIT5', 'Эксклюзив для ур. 2+', 'Exclusive for lvl 2+', 2, 500, true),
  ('SSAUDITVIP', 'VIP для ур. 5+', 'VIP for lvl 5+', 5, 100, true)
on conflict (code) do nothing;

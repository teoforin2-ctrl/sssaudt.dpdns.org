-- Sprint 0: expand MVP schema (safe to re-run)

-- ── Reference tables ───────────────────────────────────────────────
create table if not exists payment_methods (
  id serial primary key,
  code text not null unique,
  name_ru text not null,
  name_en text not null
);

create table if not exists providers (
  id serial primary key,
  code text not null unique,
  name text not null
);

-- ── Casinos: add MVP columns ───────────────────────────────────────
alter table casinos add column if not exists logo_url text;
alter table casinos add column if not exists license text;
alter table casinos add column if not exists languages text[] not null default '{ru,en}';
alter table casinos add column if not exists countries_allowed text[] not null default '{}';
alter table casinos add column if not exists countries_blocked text[] not null default '{}';
alter table casinos add column if not exists platforms text[] not null default '{web}';
alter table casinos add column if not exists player_score numeric(3,1);
alter table casinos add column if not exists base_rating numeric(4,2);
alter table casinos add column if not exists final_rating numeric(4,2);
alter table casinos add column if not exists has_representative boolean not null default false;
alter table casinos add column if not exists partner_url text;
alter table casinos add column if not exists status text not null default 'draft';
alter table casinos add column if not exists name_ru text;
alter table casinos add column if not exists name_en text;
alter table casinos add column if not exists short_desc_ru text;
alter table casinos add column if not exists short_desc_en text;

-- keep published in sync with status for old code
do $$ begin
  alter table casinos add constraint casinos_status_check
    check (status in ('draft','review','published'));
exception when duplicate_object then null;
end $$;

create table if not exists casino_payment_methods (
  casino_id uuid not null references casinos(id) on delete cascade,
  payment_method_id int not null references payment_methods(id) on delete cascade,
  primary key (casino_id, payment_method_id)
);

create table if not exists casino_providers (
  casino_id uuid not null references casinos(id) on delete cascade,
  provider_id int not null references providers(id) on delete cascade,
  primary key (casino_id, provider_id)
);

-- ── Bonuses expand ─────────────────────────────────────────────────
alter table bonuses add column if not exists title_ru text;
alter table bonuses add column if not exists title_en text;
alter table bonuses add column if not exists type text;
alter table bonuses add column if not exists amount_or_percent text;
alter table bonuses add column if not exists wager text;
alter table bonuses add column if not exists min_deposit text;
alter table bonuses add column if not exists valid_until timestamptz;
alter table bonuses add column if not exists geo text[] not null default '{}';
alter table bonuses add column if not exists source text not null default 'manual_editor';
alter table bonuses add column if not exists status text not null default 'active';
alter table bonuses add column if not exists checked_by_editor boolean not null default false;
alter table bonuses add column if not exists checked_at timestamptz;
alter table bonuses add column if not exists is_percent_deposit boolean not null default false;
alter table bonuses add column if not exists percent_value numeric(5,2);

do $$ begin
  alter table bonuses add constraint bonuses_status_check
    check (status in ('active','hidden'));
exception when duplicate_object then null;
end $$;

-- ── Reviews expand ─────────────────────────────────────────────────
alter table reviews add column if not exists player_id uuid;
alter table reviews add column if not exists played_duration text;
alter table reviews add column if not exists issues_registration boolean;
alter table reviews add column if not exists issues_deposit boolean;
alter table reviews add column if not exists issues_withdraw boolean;
alter table reviews add column if not exists modes_tried text;
alter table reviews add column if not exists ai_reject_reasons text[] not null default '{}';
alter table reviews add column if not exists ai_quality_score int;
alter table reviews add column if not exists reward_group text;
alter table reviews add column if not exists reward_amount_usd numeric(10,2);
alter table reviews add column if not exists reward_status text not null default 'none';
alter table reviews add column if not exists wallet_address text;
alter table reviews add column if not exists tx_hash text;
alter table reviews add column if not exists published_at timestamptz;
alter table reviews add column if not exists locale text not null default 'ru';

-- rename semantic: status already exists as moderation status
do $$ begin
  alter table reviews add constraint reviews_status_check
    check (status in ('pending','approved','rejected'));
exception when duplicate_object then null;
end $$;

-- ── Players / A/B ──────────────────────────────────────────────────
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  cookie_id text unique,
  fingerprint text,
  ab_group text,
  ab_assigned_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table players add constraint players_ab_group_check
    check (ab_group is null or ab_group in ('A','B'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table reviews
    add constraint reviews_player_id_fkey
    foreign key (player_id) references players(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ── Reward intents ─────────────────────────────────────────────────
create table if not exists reward_intents (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete set null,
  player_id uuid references players(id) on delete set null,
  ab_group text not null,
  amount_usd numeric(10,2) not null,
  wallet_address text,
  status text not null default 'pending',
  provider_ref text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table reward_intents add constraint reward_intents_status_check
    check (status in ('pending','paid','failed','cancelled'));
exception when duplicate_object then null;
end $$;

-- ── Go clicks expand ───────────────────────────────────────────────
alter table go_clicks add column if not exists casino_id uuid references casinos(id) on delete set null;
alter table go_clicks add column if not exists user_agent text;
alter table go_clicks add column if not exists subid text;
alter table go_clicks add column if not exists locale text;

-- ── Helpful indexes ────────────────────────────────────────────────
create index if not exists casinos_status_idx on casinos(status);
create index if not exists casinos_final_rating_idx on casinos(final_rating desc nulls last);
create index if not exists bonuses_casino_id_idx on bonuses(casino_id);
create index if not exists reviews_casino_id_idx on reviews(casino_id);
create index if not exists reviews_status_idx on reviews(status);
create index if not exists go_clicks_casino_slug_idx on go_clicks(casino_slug);
create index if not exists go_clicks_created_at_idx on go_clicks(created_at desc);

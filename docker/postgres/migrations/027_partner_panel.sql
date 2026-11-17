-- MVP Partner Panel: RevShare gate, HOT dates, reply templates, snapshots, notifications

alter table users
  add column if not exists revshare_url text;

alter table casinos
  add column if not exists revshare_rate numeric(5,2);

alter table casinos
  add column if not exists hot_until timestamptz;

alter table casinos
  add column if not exists hot_plan text;

alter table bonuses
  add column if not exists terms_ru text;

alter table bonuses
  add column if not exists image_url text;

alter table reviews
  add column if not exists author_user_id uuid references users(id) on delete set null;

create table if not exists partner_reply_templates (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid not null references casinos(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  body text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_reply_templates_casino_idx
  on partner_reply_templates (casino_id, sort_order, created_at);

create table if not exists casino_rating_snapshots (
  casino_id uuid not null references casinos(id) on delete cascade,
  day date not null default current_date,
  editorial numeric(4,2),
  player numeric(4,2),
  base numeric(4,2),
  final numeric(4,2),
  rank int,
  primary key (casino_id, day)
);

create table if not exists user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists user_notifications_user_idx
  on user_notifications (user_id, created_at desc);

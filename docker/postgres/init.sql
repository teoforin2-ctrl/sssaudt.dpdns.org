-- Increment 0 skeleton schema
create extension if not exists "pgcrypto";

-- ── Roles (CMS + Partner) ──────────────────────────────────────────
create table if not exists roles (
  id smallserial primary key,
  code text not null unique,
  name_ru text not null,
  name_en text not null,
  description text,
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);

insert into roles (code, name_ru, name_en, description, is_staff) values
  ('author', 'Автор', 'Author', 'Черновики → отправка на проверку', true),
  ('editor', 'Редактор', 'Editor', 'Проверка, правка, публикация', true),
  ('admin', 'Админ', 'Admin', 'Полный доступ + настройки', true),
  ('partner_rep', 'Представитель казино', 'Partner representative', 'Бонусы и отзывы своего бренда (/partner)', false)
on conflict (code) do update set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  description = excluded.description,
  is_staff = excluded.is_staff;

-- ── Users (CMS / Partner accounts) ─────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  display_name text,
  role_id smallint not null references roles(id),
  casino_id uuid, -- for partner_rep; FK added after casinos
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_role_id_idx on users(role_id);

create table if not exists casinos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  editorial_score numeric(3,1),
  hot boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- partner_rep → casino (nullable for staff)
do $$ begin
  alter table users
    add constraint users_casino_id_fkey
    foreign key (casino_id) references casinos(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists bonuses (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid not null references casinos(id) on delete cascade,
  title text not null,
  promo_code text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid not null references casinos(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists go_clicks (
  id bigserial primary key,
  casino_slug text not null,
  referrer text,
  ip inet,
  created_at timestamptz not null default now()
);

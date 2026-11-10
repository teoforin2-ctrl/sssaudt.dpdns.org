-- Apply on existing DB (init.sql already ran once)
create extension if not exists "pgcrypto";

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

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  display_name text,
  role_id smallint not null references roles(id),
  casino_id uuid references casinos(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_role_id_idx on users(role_id);

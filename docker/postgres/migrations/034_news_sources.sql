-- Admin-managed news sources for the newsbot pipeline.
create table if not exists news_sources (
  id serial primary key,
  name text not null unique,
  kind text not null default 'rss',
  url text,
  path text,
  priority int not null default 5,
  enabled boolean not null default true,
  last_check_at timestamptz,
  last_check_ok boolean,
  last_check_items int,
  last_check_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

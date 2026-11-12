create table if not exists seo_vitals (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  path text not null,
  locale text not null default 'ru',
  lcp_ms integer,
  inp_ms integer,
  cls numeric(8,4),
  ttfb_ms integer,
  nav_type text
);

create index if not exists seo_vitals_created_idx on seo_vitals (created_at desc);

create table if not exists seo_bot_hits (
  day date not null,
  bot text not null,
  hits integer not null default 0,
  primary key (day, bot)
);

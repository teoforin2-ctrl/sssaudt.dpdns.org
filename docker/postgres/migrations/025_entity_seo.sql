-- Per-entity SEO overrides (title/description/h1 by locale + optional ogImage).
-- Shape: { "ru": { "title", "description", "h1" }, "en": { ... }, "ogImage": "/uploads/..." }

alter table casinos
  add column if not exists seo jsonb not null default '{}'::jsonb;

alter table slots
  add column if not exists seo jsonb not null default '{}'::jsonb;

alter table articles
  add column if not exists seo jsonb not null default '{}'::jsonb;

alter table bonuses
  add column if not exists seo jsonb not null default '{}'::jsonb;

comment on column casinos.seo is
  'Per-locale SEO overrides: {ru,en}.{title,description,h1} + optional ogImage path';
comment on column slots.seo is
  'Per-locale SEO overrides: {ru,en}.{title,description,h1} + optional ogImage path';
comment on column articles.seo is
  'Per-locale SEO overrides: {ru,en}.{title,description,h1} + optional ogImage path';
comment on column bonuses.seo is
  'Per-locale SEO overrides: {ru,en}.{title,description,h1} + optional ogImage path';

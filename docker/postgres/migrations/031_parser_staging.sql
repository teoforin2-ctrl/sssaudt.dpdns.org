-- Parser sources + enriched staging for admin «Парсер»

create table if not exists parser_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_url text,
  content_types text[] not null default '{}'::text[],
  enabled boolean not null default true,
  notes text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parser_sources_enabled_idx on parser_sources (enabled, name);

-- Enrich ai_staging (created in 030)
alter table ai_staging
  add column if not exists source_id uuid references parser_sources(id) on delete set null,
  add column if not exists source_code text,
  add column if not exists external_id text,
  add column if not exists dedupe_key text,
  add column if not exists scraped_at timestamptz not null default now(),
  add column if not exists ai_status text not null default 'none'
    check (ai_status in ('none', 'queued', 'processing', 'done', 'error')),
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null,
  add column if not exists ai_processed_at timestamptz,
  add column if not exists published boolean not null default false,
  add column if not exists published_at timestamptz;

-- Expand process_status for clearer pipeline (keep old values)
alter table ai_staging drop constraint if exists ai_staging_process_status_check;
alter table ai_staging
  add constraint ai_staging_process_status_check
  check (process_status in (
    'new',        -- только спарсено
    'queued',     -- в очереди ИИ
    'processing', -- ИИ обрабатывает
    'ai_done',    -- ИИ готов, ещё не на сайте / черновик
    'published',  -- есть live и опубликовано
    'done',       -- legacy alias for completed pipeline
    'error',
    'rejected'
  ));

create unique index if not exists ai_staging_dedupe_key_uidx
  on ai_staging (dedupe_key)
  where dedupe_key is not null;

create index if not exists ai_staging_source_idx
  on ai_staging (source_code, content_type, process_status, scraped_at desc);

create index if not exists ai_staging_filters_idx
  on ai_staging (content_type, process_status, ai_status, published, scraped_at desc);

create index if not exists ai_staging_source_id_idx on ai_staging (source_id);

-- Seed a few placeholder sources (safe upsert)
insert into parser_sources (code, name, base_url, content_types, notes)
values
  ('manual', 'Ручной импорт', null, array['article','casino','slot','forum']::text[], 'Загрузка без внешнего парсера'),
  ('demo_articles', 'Demo articles feed', 'https://example.com', array['article']::text[], 'Плейсхолдер для тестов'),
  ('demo_casinos', 'Demo casinos feed', 'https://example.com', array['casino']::text[], 'Плейсхолдер для тестов')
on conflict (code) do nothing;

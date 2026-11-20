-- AI content pipeline: settings, jobs queue, token usage, article AI flags

create table if not exists ai_settings (
  id smallint primary key default 1 check (id = 1),
  openai_api_key_enc text,
  openai_api_key_hint text,
  model text not null default 'gpt-4o-mini',
  source_locales text[] not null default array['en']::text[],
  target_locales text[] not null default array['ru']::text[],
  auto_process boolean not null default false,
  daily_token_limit int,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);

insert into ai_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists ai_jobs (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid,
  content_slug text,
  action text not null default 'process',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed', 'cancelled')),
  source_locale text,
  target_locales text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  model text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists ai_jobs_status_created_idx on ai_jobs (status, created_at);
create index if not exists ai_jobs_content_idx on ai_jobs (content_type, content_id);

create table if not exists ai_usage_daily (
  day date not null,
  content_type text not null default 'all',
  action text not null default 'all',
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  requests int not null default 0,
  primary key (day, content_type, action)
);

alter table articles
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_source_locale text,
  add column if not exists ai_model text,
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null;

create index if not exists articles_ai_processed_idx
  on articles (ai_processed_at)
  where ai_processed_at is not null;

-- Staging placeholders for future parsers (wave 4)
create table if not exists ai_staging (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  source_url text,
  source_locale text,
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  process_status text not null default 'new'
    check (process_status in ('new', 'queued', 'done', 'error', 'rejected')),
  live_id uuid,
  live_slug text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_staging_status_idx on ai_staging (process_status, content_type, created_at);

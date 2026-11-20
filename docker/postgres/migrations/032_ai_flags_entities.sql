-- AI flags on casinos, slots, forum categories (wave 3)

alter table casinos
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_source_locale text,
  add column if not exists ai_model text,
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null;

create index if not exists casinos_ai_processed_idx
  on casinos (ai_processed_at)
  where ai_processed_at is not null;

alter table slots
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_source_locale text,
  add column if not exists ai_model text,
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null;

create index if not exists slots_ai_processed_idx
  on slots (ai_processed_at)
  where ai_processed_at is not null;

alter table forum_categories
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_source_locale text,
  add column if not exists ai_model text,
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null;

-- UGC policy: topics/posts are not auto-rewritten unless explicitly flagged
alter table forum_topics
  add column if not exists ai_allowed boolean not null default false,
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_source_locale text,
  add column if not exists ai_model text,
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null;

alter table forum_posts
  add column if not exists ai_allowed boolean not null default false,
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_source_locale text,
  add column if not exists ai_model text,
  add column if not exists ai_job_id uuid references ai_jobs(id) on delete set null;

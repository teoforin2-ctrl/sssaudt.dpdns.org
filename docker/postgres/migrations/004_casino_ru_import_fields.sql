-- Fields for casino.ru migration import
alter table casinos add column if not exists source text;
alter table casinos add column if not exists source_url text;
alter table casinos add column if not exists external_slug text;
alter table casinos add column if not exists og_description text;
alter table casinos add column if not exists info_json jsonb;
alter table casinos add column if not exists go_urls text[] not null default '{}';
alter table casinos add column if not exists logo_local text;

create unique index if not exists casinos_external_slug_uidx
  on casinos(external_slug) where external_slug is not null;

alter table bonuses add column if not exists source_url text;
alter table bonuses add column if not exists props_json jsonb;
alter table bonuses add column if not exists description text;

alter table reviews add column if not exists source text;
alter table reviews add column if not exists source_url text;
alter table reviews add column if not exists author_name text;
alter table reviews add column if not exists author_rank text;
alter table reviews add column if not exists date_text text;
alter table reviews add column if not exists body_hash text;

create unique index if not exists reviews_body_hash_casino_uidx
  on reviews(casino_id, body_hash) where body_hash is not null;

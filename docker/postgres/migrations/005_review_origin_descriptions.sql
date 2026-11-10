-- Phase 2: review origin / seed flags + long descriptions
alter table reviews add column if not exists origin text not null default 'ugc';
alter table reviews add column if not exists is_seed boolean not null default false;
alter table reviews add column if not exists language text;

do $$ begin
  alter table reviews add constraint reviews_origin_check
    check (origin in ('ugc', 'editorial'));
exception when duplicate_object then null;
end $$;

alter table casinos add column if not exists description_ru text;
alter table casinos add column if not exists description_en text;

alter table bonuses add column if not exists description_ru text;
alter table bonuses add column if not exists description_en text;

create index if not exists reviews_origin_status_idx
  on reviews (casino_id, origin, status);

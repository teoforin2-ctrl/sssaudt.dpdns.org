-- Preserve editorial ranking order from legacy portal (SortOrder)
alter table casinos add column if not exists sort_order integer not null default 0;

create index if not exists casinos_sort_order_idx
  on casinos (sort_order asc, final_rating desc nulls last);

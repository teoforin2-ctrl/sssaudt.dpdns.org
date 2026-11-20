-- Author photo + localized display name for trust / expert block
alter table authors
  add column if not exists photo_url text,
  add column if not exists name_ru text;

update authors
set
  photo_url = coalesce(photo_url, '/img/authors/mira-volkova.jpg'),
  name_ru = coalesce(nullif(name_ru, ''), 'Мира Волкова')
where slug = 'mira-volkova';

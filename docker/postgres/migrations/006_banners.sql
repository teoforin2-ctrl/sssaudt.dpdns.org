-- Home / promo banners: one row = one banner with RU + EN assets

create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  placement text not null default 'home_hero',
  title_ru text,
  title_en text,
  image_ru text not null,
  image_en text not null,
  href_ru text,
  href_en text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banners_placement_active_idx
  on banners (placement, active, sort_order);

insert into banners (
  slug, placement, title_ru, title_en, image_ru, image_en, href_ru, href_en, sort_order, active
) values
  ('home-igaming-1', 'home_hero', 'Самый актуальный iGaming рейтинг', 'The most up-to-date iGaming rating', '/img/banners/banner_1_ru.png', '/img/banners/banner_1_en.png', '/', '/', 10, true),
  ('home-igaming-2', 'home_hero', 'Бонусы и акции казино', 'Casino bonuses and offers', '/img/banners/banner_2_ru.png', '/img/banners/banner_2_en.png', '/bonuses', '/bonuses', 20, true),
  ('home-igaming-3', 'home_hero', 'Игровые автоматы онлайн', 'Online slot machines', '/img/banners/banner_3_ru.png', '/img/banners/banner_3_en.png', '/slots', '/slots', 30, true),
  ('home-igaming-4', 'home_hero', 'Честные отзывы игроков', 'Honest player reviews', '/img/banners/banner_4_ru.png', '/img/banners/banner_4_en.png', '/', '/', 40, true),
  ('home-igaming-5', 'home_hero', 'Лучшие слоты и провайдеры', 'Best slots and providers', '/img/banners/banner_5_ru.png', '/img/banners/banner_5_en.png', '/slots', '/slots', 50, true),
  ('home-igaming-6', 'home_hero', 'Выбирайте казино осознанно', 'Choose casinos wisely', '/img/banners/banner_6_ru.png', '/img/banners/banner_6_en.png', '/', '/', 60, true)
on conflict (slug) do update set
  placement = excluded.placement,
  title_ru = excluded.title_ru,
  title_en = excluded.title_en,
  image_ru = excluded.image_ru,
  image_en = excluded.image_en,
  href_ru = excluded.href_ru,
  href_en = excluded.href_en,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

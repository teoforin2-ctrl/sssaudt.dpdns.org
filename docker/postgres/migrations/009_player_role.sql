-- Regular site users (ЛК); registration assigns this role

insert into roles (code, name_ru, name_en, description, is_staff) values
  ('player', 'Игрок', 'Player', 'Обычный пользователь сайта / личный кабинет', false)
on conflict (code) do update set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  description = excluded.description,
  is_staff = excluded.is_staff;

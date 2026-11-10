-- Developer role (= admin rights) + seed account edmccain

insert into roles (code, name_ru, name_en, description, is_staff) values
  (
    'developer',
    'Разработчик',
    'Developer',
    'Полный доступ как у админа (разработка / отладка)',
    true
  )
on conflict (code) do update set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  description = excluded.description,
  is_staff = excluded.is_staff;

-- Login: edmccain (or edmccain@casino-review.local) / mccain128
insert into users (email, display_name, role_id, password_hash, is_active)
select
  'edmccain@casino-review.local',
  'edmccain',
  r.id,
  '$2b$10$uJZewho6x6eLisBFvFybxeoVVxcSyd..H42NUG49UhELwaQqb2F5e',
  true
from roles r
where r.code = 'developer'
on conflict (email) do update set
  display_name = excluded.display_name,
  role_id = excluded.role_id,
  password_hash = excluded.password_hash,
  is_active = true,
  updated_at = now();

-- Bind cookie players to registered users; complaints belong to account.

alter table players add column if not exists user_id uuid references users(id) on delete set null;
create unique index if not exists players_user_id_uidx on players (user_id) where user_id is not null;

alter table complaints add column if not exists author_user_id uuid references users(id) on delete set null;
create index if not exists complaints_author_user_idx on complaints (author_user_id);

-- Demo player (same bcrypt as admin123)
insert into users (email, display_name, role_id, password_hash, is_active)
select
  'player@casino-review.local',
  'Player',
  r.id,
  '$2b$10$WelBsDW8O5f5HuJDbh3gceUdeUUI8ubi1JtZnBNH0KEm9LJ8okBI2',
  true
from roles r
where r.code = 'player'
  and not exists (select 1 from users u where u.email = 'player@casino-review.local');

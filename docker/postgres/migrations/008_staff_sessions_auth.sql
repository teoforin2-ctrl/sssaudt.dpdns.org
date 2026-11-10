-- Staff sessions + seed bcrypt passwords for demo CMS accounts
-- Demo password for admin@ / editor@: admin123

create table if not exists staff_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip inet
);

create index if not exists staff_sessions_user_id_idx on staff_sessions(user_id);
create index if not exists staff_sessions_expires_at_idx on staff_sessions(expires_at);

-- bcrypt hash for "admin123" (cost 10)
update users
set password_hash = '$2b$10$WelBsDW8O5f5HuJDbh3gceUdeUUI8ubi1JtZnBNH0KEm9LJ8okBI2',
    updated_at = now()
where email in ('admin@casino-review.local', 'editor@casino-review.local')
  and (password_hash is null or password_hash = 'stub' or password_hash not like '$2%');

update users
set password_hash = '$2b$10$WelBsDW8O5f5HuJDbh3gceUdeUUI8ubi1JtZnBNH0KEm9LJ8okBI2',
    updated_at = now()
where email = 'partner@pokerdom.local'
  and (password_hash is null or password_hash = 'stub' or password_hash not like '$2%');

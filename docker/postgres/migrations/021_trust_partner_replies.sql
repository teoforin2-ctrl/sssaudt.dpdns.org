-- P2 trust: lawyer role, complaints, blacklist · P4 partner review replies

begin;

insert into roles (code, name_ru, name_en, description, is_staff) values
  (
    'lawyer',
    'Юрист',
    'Lawyer',
    'Модерация ЧС / жалоб: публикация только после отметки юриста',
    true
  )
on conflict (code) do update set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  description = excluded.description,
  is_staff = excluded.is_staff;

create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid references casinos(id) on delete set null,
  casino_slug text,
  casino_name text,
  author_name text,
  author_email text,
  subject text not null,
  body text not null,
  status text not null default 'new'
    check (status in ('new', 'in_review', 'need_info', 'resolved', 'rejected')),
  staff_note text,
  assigned_to uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists complaints_status_idx on complaints(status, created_at desc);
create index if not exists complaints_casino_idx on complaints(casino_id);

create table if not exists blacklist_entries (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid references casinos(id) on delete set null,
  name text not null,
  slug text,
  reason_ru text not null default '',
  reason_en text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'pending_lawyer', 'published', 'rejected')),
  created_by uuid references users(id) on delete set null,
  lawyer_id uuid references users(id) on delete set null,
  lawyer_note text,
  lawyer_approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blacklist_status_idx on blacklist_entries(status, published_at desc);

create table if not exists review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id)
);
create index if not exists review_replies_review_idx on review_replies(review_id);

-- Demo lawyer account (same password as admin123)
insert into users (email, display_name, role_id, password_hash, is_active)
select
  'lawyer@casino-review.local',
  'Lawyer',
  r.id,
  '$2b$10$WelBsDW8O5f5HuJDbh3gceUdeUUI8ubi1JtZnBNH0KEm9LJ8okBI2',
  true
from roles r
where r.code = 'lawyer'
on conflict (email) do update set
  role_id = excluded.role_id,
  is_active = true,
  updated_at = now();

commit;

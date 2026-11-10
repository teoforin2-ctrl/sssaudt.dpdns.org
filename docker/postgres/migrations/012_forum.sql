-- Forum: categories, topics, posts (imported from legacy portal + live demo)

create table if not exists forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  icon text not null default '',
  title_ru text not null,
  title_en text not null,
  description_ru text not null default '',
  description_en text not null default '',
  sort_order int not null default 0,
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists forum_topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references forum_categories(id) on delete cascade,
  slug text not null unique,
  title text not null,
  tags jsonb not null default '[]'::jsonb,
  author_name text not null,
  author_badge text,
  author_user_id uuid references users(id) on delete set null,
  posts_count int not null default 0,
  views_count int not null default 0,
  is_locked boolean not null default false,
  is_pinned boolean not null default false,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_post_at timestamptz not null default now()
);

create index if not exists forum_topics_category_idx on forum_topics (category_id, last_post_at desc);
create index if not exists forum_topics_status_idx on forum_topics (status, last_post_at desc);

create table if not exists forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references forum_topics(id) on delete cascade,
  author_name text not null,
  author_badge text,
  author_user_id uuid references users(id) on delete set null,
  body_md text not null,
  quote_author text,
  quote_text text,
  helpful int not null default 0,
  sort_order int not null default 0,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forum_posts_topic_idx on forum_posts (topic_id, sort_order, created_at);
create index if not exists forum_posts_status_idx on forum_posts (status);

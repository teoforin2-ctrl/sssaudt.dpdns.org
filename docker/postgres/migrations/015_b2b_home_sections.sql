-- B2B turnkey packages / cases / leads + homepage section flags.

alter table site_settings
  alter column home_sections set default '{
    "heroStats": true,
    "heroBanners": true,
    "listing": true,
    "aside": true,
    "slots": true,
    "promoBanner": true,
    "newSlots": true,
    "articles": true,
    "guides": true,
    "partnerBrands": false,
    "expert": true,
    "trust": true,
    "communityStats": true,
    "method": true,
    "homeBonuses": true,
    "homeForum": true,
    "homeB2b": true
  }'::jsonb;

update site_settings
set home_sections = coalesce(home_sections, '{}'::jsonb) || '{
  "partnerBrands": false,
  "homeBonuses": true,
  "homeForum": true,
  "homeB2b": true
}'::jsonb
where id = 1;

create table if not exists b2b_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ru text not null,
  title_en text not null,
  price_label_ru text,
  price_label_en text,
  features_ru jsonb not null default '[]'::jsonb,
  features_en jsonb not null default '[]'::jsonb,
  highlight boolean not null default false,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists b2b_cases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ru text not null,
  title_en text not null,
  summary_ru text,
  summary_en text,
  metrics_ru jsonb not null default '[]'::jsonb,
  metrics_en jsonb not null default '[]'::jsonb,
  cover_url text,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists b2b_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  project_type text not null default 'white-label',
  budget text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'spam')),
  locale text not null default 'ru',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2b_leads_status_idx on b2b_leads (status, created_at desc);
create index if not exists b2b_packages_sort_idx on b2b_packages (published, sort_order);
create index if not exists b2b_cases_sort_idx on b2b_cases (published, sort_order);

insert into b2b_packages (slug, title_ru, title_en, price_label_ru, price_label_en, features_ru, features_en, highlight, sort_order)
values
  (
    'starter',
    'Starter',
    'Starter',
    'от $30k',
    'from $30k',
    '["White Label платформа","1 500+ игр","Базовые платежи","Поддержка 8/5"]'::jsonb,
    '["White Label platform","1,500+ games","Core payments","Support 8/5"]'::jsonb,
    false,
    10
  ),
  (
    'pro',
    'Pro',
    'Pro',
    'от $80k',
    'from $80k',
    '["Кастомизация бренда","5 000+ игр","Все платежи + крипто","CRM + Affiliate","Поддержка 24/7"]'::jsonb,
    '["Brand customization","5,000+ games","All payments + crypto","CRM + Affiliate","24/7 support"]'::jsonb,
    true,
    20
  ),
  (
    'enterprise',
    'Enterprise',
    'Enterprise',
    'по запросу',
    'on request',
    '["Собственная архитектура","Прямые интеграции","Multi-jurisdiction","Выделенная команда","SLA 15 минут"]'::jsonb,
    '["Custom architecture","Direct integrations","Multi-jurisdiction","Dedicated team","15-min SLA"]'::jsonb,
    false,
    30
  )
on conflict (slug) do nothing;

insert into b2b_cases (slug, title_ru, title_en, summary_ru, summary_en, metrics_ru, metrics_en, sort_order)
values
  (
    'orobet',
    'OroBet',
    'OroBet',
    'Крипто-казино с быстрым запуском и Curacao.',
    'Crypto casino with fast launch and Curacao.',
    '["12 000 регистраций / мес","GGR +180% за 90 дней","Лицензия Curacao"]'::jsonb,
    '["12k registrations / mo","GGR +180% in 90 days","Curacao license"]'::jsonb,
    10
  ),
  (
    'neonplay',
    'NeonPlay',
    'NeonPlay',
    'Мультиязычный mobile-first бренд.',
    'Multilingual mobile-first brand.',
    '["8 валют, 4 языка","240+ игр в первую неделю","Mobile-first"]'::jsonb,
    '["8 currencies, 4 languages","240+ games in week one","Mobile-first"]'::jsonb,
    20
  ),
  (
    'altcasino',
    'AltCasino',
    'AltCasino',
    'Крипто-стек с Telegram-ботом и PWA.',
    'Crypto stack with Telegram bot and PWA.',
    '["BTC, ETH, USDT, SOL","Provably fair","PWA + Telegram"]'::jsonb,
    '["BTC, ETH, USDT, SOL","Provably fair","PWA + Telegram"]'::jsonb,
    30
  )
on conflict (slug) do nothing;

-- Singleton site branding + contacts (editable from admin).

create table if not exists site_settings (
  id smallint primary key default 1 check (id = 1),
  site_name text not null default 'SS Audit',
  logo_url text,
  favicon_url text,
  favicon_32_url text,
  apple_touch_icon_url text,
  contacts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into site_settings (
  id, site_name, logo_url, favicon_url, favicon_32_url, apple_touch_icon_url, contacts
) values (
  1,
  'SS Audit',
  '/img/brand/logo.png',
  '/favicon.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '{
    "email": "editorial@ss-audit.local",
    "email_partners": "partners@ss-audit.local",
    "telegram": "",
    "vk": "",
    "youtube": "",
    "x": "",
    "instagram": "",
    "facebook": "",
    "discord": ""
  }'::jsonb
)
on conflict (id) do nothing;

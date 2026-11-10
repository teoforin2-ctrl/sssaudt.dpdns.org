-- Homepage section visibility (admin-editable).

alter table site_settings
  add column if not exists home_sections jsonb not null default '{
    "heroStats": true,
    "heroBanners": true,
    "listing": true,
    "aside": true,
    "slots": true,
    "promoBanner": true,
    "newSlots": true,
    "articles": true,
    "guides": true,
    "partnerBrands": true,
    "expert": true,
    "trust": true,
    "communityStats": true,
    "method": true
  }'::jsonb;

update site_settings
set home_sections = coalesce(home_sections, '{}'::jsonb) || '{
  "heroStats": true,
  "heroBanners": true,
  "listing": true,
  "aside": true,
  "slots": true,
  "promoBanner": true,
  "newSlots": true,
  "articles": true,
  "guides": true,
  "partnerBrands": true,
  "expert": true,
  "trust": true,
  "communityStats": true,
  "method": true
}'::jsonb
where id = 1;

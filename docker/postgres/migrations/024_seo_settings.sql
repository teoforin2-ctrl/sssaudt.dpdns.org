-- SEO core settings (admin-controlled indexing + meta defaults).

alter table site_settings
  add column if not exists seo_settings jsonb not null default '{}'::jsonb;

comment on column site_settings.seo_settings is
  'Admin SEO: indexingEnabled, canonicalHost, templates, AI bot policy, default OG.';

update site_settings
set seo_settings = coalesce(seo_settings, '{}'::jsonb) || jsonb_build_object(
  'indexingEnabled', false,
  'canonicalHost', 'dfijdsif.website',
  'defaultOgImage', '/img/brand/logo.webp',
  'organizationSameAs', '[]'::jsonb,
  'aiRetrievalAllow', true,
  'aiTrainingAllow', false,
  'templates', jsonb_build_object(
    'home', jsonb_build_object(
      'title', 'Обзоры онлайн-казино 2026 — рейтинг, бонусы и отзывы — {siteName}',
      'description', 'Редакционные обзоры казино: бонусы, выплаты, отзывы игроков. Честные оценки без обещаний выигрыша. 18+',
      'h1', 'Рейтинг онлайн-казино'
    ),
    'casino', jsonb_build_object(
      'title', '{casino} — обзор и отзывы игроков 2026 — {siteName}',
      'description', 'Обзор {casino}: бонусы, выплаты, лицензия. Отзывы игроков и редакционная оценка. 18+',
      'h1', '{casino} — обзор'
    )
  )
)
where id = 1
  and (seo_settings = '{}'::jsonb or seo_settings->>'indexingEnabled' is null);

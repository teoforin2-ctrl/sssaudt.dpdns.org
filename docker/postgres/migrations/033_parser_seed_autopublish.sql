-- Auto-publish flag + demo scraped staging rows

alter table ai_settings
  add column if not exists auto_publish boolean not null default false;

insert into parser_sources (code, name, base_url, content_types, notes)
values
  ('demo_slots', 'Demo slots scrape', 'https://slots.example.com', array['slot']::text[], 'Демо-парсер слотов'),
  ('demo_forum', 'Demo forum scrape', 'https://forum.example.com', array['forum']::text[], 'Демо-парсер форума')
on conflict (code) do nothing;

-- Seed staging as if scraped from external sites (idempotent via dedupe_key)
with src as (
  select code, id from parser_sources
),
rows(content_type, source_code, source_url, source_locale, external_id, dedupe_key, title, body, payload) as (
  values
  (
    'article',
    'demo_articles',
    'https://news.example.com/guides/welcome-bonus-checklist-2026',
    'en',
    'art-1001',
    'seed::article::art-1001',
    'Welcome Bonus Checklist: What to Verify Before Depositing',
    E'## Why bonuses look better than they are\n\nBefore you claim a casino welcome package, check wagering, game weighting, and max cashout.\n\n### Quick checklist\n- Wagering multiplier on bonus and deposits\n- Expiry window\n- Restricted payment methods\n\nPlay responsibly. This is editorial guidance, not a promise of winnings.',
    '{"kind":"guide","topic":"bonuses","scraped_from":"demo"}'::text
  ),
  (
    'article',
    'demo_articles',
    'https://news.example.com/guides/rtp-explained-simply',
    'en',
    'art-1002',
    'seed::article::art-1002',
    'RTP Explained Simply for New Players',
    E'## RTP is not a personal guarantee\n\nReturn to Player is a long-run statistical measure. Short sessions can deviate a lot.\n\n### What to remember\n- Higher RTP does not mean you will win today\n- Volatility changes the ride\n- Always use licensed operators\n\nKeep stakes affordable.',
    '{"kind":"guide","topic":"basics","scraped_from":"demo"}'::text
  ),
  (
    'article',
    'demo_articles',
    'https://news.example.com/ru/news/new-payment-methods-wave',
    'ru',
    'art-1003',
    'seed::article::art-1003',
    'Новая волна платёжек: на что смотреть игроку',
    E'## Комиссии и скорость\n\nПеред депозитом проверьте минимальную сумму, комиссии и лимиты вывода.\n\n### Чеклист\n- Поддерживается ли ваш регион\n- Сколько идёт вывод\n- Есть ли верификация кошелька\n\nИграйте ответственно.',
    '{"kind":"news","topic":"payments","scraped_from":"demo"}'::text
  ),
  (
    'casino',
    'demo_casinos',
    'https://directory.example.com/casinos/nordic-spin-hub',
    'en',
    'cas-2001',
    'seed::casino::cas-2001',
    'Nordic Spin Hub',
    E'Nordic Spin Hub positions itself as a clean desktop-first casino with a short onboarding flow.\n\nEditorial notes from scrape:\n- Claims multi-currency wallet\n- Lists common card and e-wallet rails\n- No verified license string in the source page footer (flag for manual check)\n\nShort blurb: Straightforward lobby, focus on slots and live tables.',
    '{"name":"Nordic Spin Hub","license":"pending-review","short":"Clean desktop-first lobby with multi-currency claims.","scraped_from":"demo"}'::text
  ),
  (
    'casino',
    'demo_casinos',
    'https://directory.example.com/casinos/aurora-bet-lounge',
    'en',
    'cas-2002',
    'seed::casino::cas-2002',
    'Aurora Bet Lounge',
    E'Aurora Bet Lounge markets a compact sports + casino hybrid.\n\nScraped signals:\n- Geo banner mentions EU players\n- Bonus page shows sticky wagering terms\n- Support chat widget present\n\nShort blurb: Hybrid sportsbook and casino with visible chat support.',
    '{"name":"Aurora Bet Lounge","license":"MGA-claim-unverified","short":"Hybrid sports + casino with visible support chat.","scraped_from":"demo"}'::text
  ),
  (
    'slot',
    'demo_slots',
    'https://slots.example.com/games/crystal-vault-ways',
    'en',
    'slot-3001',
    'seed::slot::slot-3001',
    'Crystal Vault Ways',
    E'Crystal Vault Ways is presented as a gem-themed ways-to-win slot.\n\nFrom the provider page (do not invent RTP):\n- Theme: crystals / vault\n- Feature callouts: cascading wins, collect meters\n- Demo button present on source\n\nEditorial rewrite should keep unknowns unmarked.',
    '{"title":"Crystal Vault Ways","theme":"gems","volatility":"high","grid":"6x5","scraped_from":"demo"}'::text
  ),
  (
    'slot',
    'demo_slots',
    'https://slots.example.com/games/harbor-lights-hold',
    'en',
    'slot-3002',
    'seed::slot::slot-3002',
    'Harbor Lights Hold & Win',
    E'Harbor Lights Hold & Win uses a coastal night theme with a hold-and-win bonus round according to the scrape.\n\nKnown from source only:\n- Hold & Win style feature named on page\n- Medium volatility label in badge\n- Mobile screenshot gallery\n\nDo not invent RTP percentages.',
    '{"title":"Harbor Lights Hold & Win","theme":"sea","volatility":"medium","grid":"5x3","scraped_from":"demo"}'::text
  ),
  (
    'forum',
    'demo_forum',
    'https://forum.example.com/categories/payments-disputes',
    'en',
    'forum-4001',
    'seed::forum::forum-4001',
    'Payments & Withdrawal Disputes',
    E'Community category for players discussing payout delays, KYC friction, and payment method issues.\n\nModeration note from scrape: keep tone neutral, no brand-bashing templates.',
    '{"title_en":"Payments & Withdrawal Disputes","title_ru":"Платежи и споры по выводу","scraped_from":"demo"}'::text
  )
)
insert into ai_staging (
  content_type, source_id, source_code, source_url, source_locale,
  external_id, dedupe_key, title, body, payload, process_status, scraped_at
)
select
  r.content_type,
  s.id,
  r.source_code,
  r.source_url,
  r.source_locale,
  r.external_id,
  r.dedupe_key,
  r.title,
  r.body,
  r.payload::jsonb,
  'new',
  now() - (random() * interval '3 days')
from rows r
left join src s on s.code = r.source_code
on conflict (dedupe_key) where (dedupe_key is not null) do update set
  title = excluded.title,
  body = excluded.body,
  payload = excluded.payload,
  source_url = excluded.source_url,
  source_locale = excluded.source_locale,
  source_id = excluded.source_id,
  source_code = excluded.source_code,
  process_status = case
    when ai_staging.process_status in ('published', 'queued', 'processing', 'ai_done')
      then ai_staging.process_status
    else 'new'
  end,
  updated_at = now();

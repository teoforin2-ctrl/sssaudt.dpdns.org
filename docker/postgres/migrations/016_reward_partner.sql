-- S3: reward program settings (admin) + partner representative request flag

alter table site_settings
  add column if not exists reward_settings jsonb not null default '{}'::jsonb;

alter table casinos
  add column if not exists representative_requested_at timestamptz;

alter table casinos
  add column if not exists representative_requested_by uuid references users(id) on delete set null;

comment on column site_settings.reward_settings is
  'Admin-editable reward/payout/A-B config JSON (currency, network, amounts, mock mode, antifraud)';

-- Default seed for reward settings if empty
update site_settings
set reward_settings = jsonb_build_object(
  'enabled', true,
  'currency', 'USDT',
  'network', 'TRON (TRC-20)',
  'explorerTxTemplate', 'https://tronscan.org/#/transaction/{hash}',
  'fixedAmountA', 1,
  'rewardPreviewB', 'случайную награду до $100',
  'wheelTable', jsonb_build_array(
    jsonb_build_object('amount', 0.5, 'p', 0.538),
    jsonb_build_object('amount', 1, 'p', 0.34),
    jsonb_build_object('amount', 1.5, 'p', 0.1),
    jsonb_build_object('amount', 2, 'p', 0.02),
    jsonb_build_object('amount', 100, 'p', 0.002)
  ),
  'payoutMode', 'mock',
  'minReviewChars', 250,
  'moderationDelayMs', 2500,
  'payoutDelayMs', 2000,
  'rateLimitPerHour', 5,
  'blockDuplicateWallet', true,
  'maxPaidReviewsPerPlayerCasino', 1
)
where id = 1
  and (reward_settings = '{}'::jsonb or reward_settings is null);

-- Demo partner bound to pokerdom (idempotent)
update users u
set casino_id = c.id
from casinos c, roles r
where u.email = 'partner@pokerdom.local'
  and u.role_id = r.id
  and r.code = 'partner_rep'
  and c.slug = 'pokerdom'
  and u.casino_id is null;

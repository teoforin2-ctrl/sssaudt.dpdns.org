-- P1: link payments/providers to casinos + sample slot↔casino for «где играть»

begin;

-- Every published casino gets core payment methods (visa/mc + one crypto)
insert into casino_payment_methods (casino_id, payment_method_id)
select c.id, pm.id
from casinos c
cross join payment_methods pm
where c.published = true
  and pm.code in ('visa', 'mastercard', 'usdt')
on conflict do nothing;

-- HOT / top-rated also get SBP + BTC + ETH
insert into casino_payment_methods (casino_id, payment_method_id)
select c.id, pm.id
from casinos c
cross join payment_methods pm
where c.published = true
  and (c.hot = true or coalesce(c.final_rating, c.editorial_score, 0) >= 4.8)
  and pm.code in ('sbp', 'btc', 'eth')
on conflict do nothing;

-- Softswiss-style game studios from `providers` ref table → top casinos
insert into casino_providers (casino_id, provider_id)
select c.id, p.id
from casinos c
cross join providers p
where c.published = true
  and (
    c.hot = true
    or coalesce(c.final_rating, c.editorial_score, 0) >= 4.7
    or c.slug in ('pokerdom', 'riobet', 'joycasino', 'vodka', 'get-x', 'pinco', 'starda', 'monro')
  )
on conflict do nothing;

-- Remaining published casinos get at least pragmatic + netent
insert into casino_providers (casino_id, provider_id)
select c.id, p.id
from casinos c
cross join providers p
where c.published = true
  and p.code in ('pragmatic', 'netent')
  and not exists (select 1 from casino_providers cp where cp.casino_id = c.id)
on conflict do nothing;

-- Slot ↔ casino: attach published slots to top 12 casinos (for provider/slot «где играть»)
insert into slot_casinos (slot_id, casino_id)
select s.id, c.id
from slots s
cross join lateral (
  select id
  from casinos
  where published = true
  order by hot desc, coalesce(final_rating, editorial_score, 0) desc
  limit 12
) c
where s.status = 'published'
on conflict do nothing;

commit;

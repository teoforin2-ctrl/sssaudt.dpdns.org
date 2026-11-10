-- Bonus descriptions were imported as JSON text with \uXXXX escapes:
--   ["\u0411\u043E\u043D\u0443\u0441 ..."]
-- Decode once into plain UTF-8 (idempotent for already-plain rows).

create or replace function xr_decode_stored_text(raw text)
returns text
language plpgsql
immutable
as $$
declare
  parsed jsonb;
  elem text;
  acc text := '';
  first boolean := true;
begin
  if raw is null or btrim(raw) = '' then
    return raw;
  end if;
  if left(btrim(raw), 1) not in ('[', '"') then
    return raw;
  end if;
  begin
    parsed := btrim(raw)::jsonb;
  exception when others then
    return raw;
  end;

  if jsonb_typeof(parsed) = 'string' then
    return parsed #>> '{}';
  end if;

  if jsonb_typeof(parsed) = 'array' then
    for elem in
      select value #>> '{}'
      from jsonb_array_elements(parsed) as t(value)
      where jsonb_typeof(value) = 'string'
    loop
      if first then
        acc := elem;
        first := false;
      else
        acc := acc || E'\n\n' || elem;
      end if;
    end loop;
    if not first then
      return acc;
    end if;
  end if;

  return raw;
end;
$$;

update bonuses
set
  description_ru = xr_decode_stored_text(description_ru),
  description_en = xr_decode_stored_text(description_en)
where
  (description_ru is not null and left(btrim(description_ru), 2) = '["')
  or (description_en is not null and left(btrim(description_en), 2) = '["');

#!/usr/bin/env python3
"""Import data/casino-ru/json into Postgres (xreviewer)."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "casino-ru" / "json"
DSN = os.environ.get(
  "DATABASE_URL",
  "postgresql://xreviewer:xreviewer@127.0.0.1:5435/xreviewer",
)


def slugify(s: str) -> str:
  s = s.strip().lower()
  s = re.sub(r"[^a-z0-9\-]+", "-", s)
  return re.sub(r"-+", "-", s).strip("-")


def rating_num(v) -> float | None:
  if v is None:
    return None
  if isinstance(v, (int, float)):
    return float(v)
  m = re.search(r"(\d+(?:[.,]\d+)?)", str(v))
  return float(m.group(1).replace(",", ".")) if m else None


def import_casinos(conn: psycopg.Connection) -> int:
  n = 0
  for f in sorted((DATA / "casinos").glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    slug = d.get("slug") or f.stem
    name = d.get("name") or slug
    ld = d.get("json_ld") or {}
    agg = ld.get("aggregateRating") or {}
    editorial = rating_num(agg.get("ratingValue")) or rating_num(d.get("rating_page")) or 4.0
    final = editorial  # HOT not known from scrape
    logo_local = d.get("logo_local")
    # Prefer local public path when logo file was downloaded by scrape
    logo_public = f"/img/casinos/{slug}.png" if logo_local else d.get("logo_url")
    with conn.cursor() as cur:
      cur.execute(
        """
        insert into casinos (
          slug, name, name_ru, name_en, logo_url, logo_local, license,
          editorial_score, base_rating, final_rating, partner_url, go_urls,
          status, published, source, source_url, external_slug,
          og_description, short_desc_ru, short_desc_en, info_json, hot
        ) values (
          %s,%s,%s,%s,%s,%s,%s,
          %s,%s,%s,%s,%s,
          'published', true, 'casino.ru', %s, %s,
          %s,%s,%s,%s::jsonb, false
        )
        on conflict (slug) do update set
          name = excluded.name,
          name_ru = excluded.name_ru,
          name_en = excluded.name_en,
          logo_url = coalesce(excluded.logo_url, casinos.logo_url),
          logo_local = coalesce(excluded.logo_local, casinos.logo_local),
          license = coalesce(excluded.license, casinos.license),
          editorial_score = excluded.editorial_score,
          base_rating = excluded.base_rating,
          final_rating = excluded.final_rating,
          partner_url = coalesce(excluded.partner_url, casinos.partner_url),
          go_urls = excluded.go_urls,
          source = 'casino.ru',
          source_url = excluded.source_url,
          external_slug = excluded.external_slug,
          og_description = excluded.og_description,
          short_desc_ru = excluded.short_desc_ru,
          info_json = excluded.info_json,
          status = 'published',
          published = true,
          updated_at = now()
        """,
        (
          slug,
          name,
          name,
          name,
          logo_public,
          logo_local,
          d.get("license"),
          editorial,
          editorial,
          final,
          d.get("go_url"),
          d.get("go_urls") or [],
          d.get("source_url"),
          slug,
          d.get("og_description"),
          d.get("og_description"),
          d.get("og_description"),
          json.dumps(d.get("info") or {}, ensure_ascii=False),
        ),
      )
    n += 1
  return n


def casino_id(conn: psycopg.Connection, slug: str) -> str | None:
  with conn.cursor() as cur:
    cur.execute("select id from casinos where slug = %s or external_slug = %s limit 1", (slug, slug))
    row = cur.fetchone()
    return str(row[0]) if row else None


def import_bonuses(conn: psycopg.Connection) -> int:
  n = 0
  # from dedicated bonus pages + bonuses_on_page in casino json
  files = list((DATA / "bonuses").glob("*.json")) + list((DATA / "casinos").glob("*.json"))
  for f in files:
    d = json.loads(f.read_text(encoding="utf-8"))
    slug = d.get("casino_slug") or d.get("slug") or f.stem
    cid = casino_id(conn, slug)
    if not cid:
      # try key without casino- prefix variants
      alt = slug.replace("casino-", "")
      cid = casino_id(conn, alt) or casino_id(conn, f"casino-{alt}")
    if not cid:
      continue
    bonuses = d.get("bonuses") or d.get("bonuses_on_page") or []
    for b in bonuses:
      title = b.get("title") or "Bonus"
      code = b.get("promo_code")
      props = b.get("props") or {}
      with conn.cursor() as cur:
        if code:
          cur.execute(
            "select id from bonuses where casino_id = %s and promo_code = %s and title = %s limit 1",
            (cid, code, title),
          )
        else:
          cur.execute(
            "select id from bonuses where casino_id = %s and title = %s limit 1",
            (cid, title),
          )
        if cur.fetchone():
          continue
        cur.execute(
          """
          insert into bonuses (
            casino_id, title, title_ru, title_en, promo_code, type,
            description, props_json, source, source_url, status, published,
            wager, min_deposit, amount_or_percent
          ) values (
            %s,%s,%s,%s,%s,%s,
            %s,%s::jsonb,'casino.ru',%s,'active', true,
            %s,%s,%s
          )
          """,
          (
            cid,
            title,
            title,
            title,
            code,
            (b.get("types") or [None])[0] or b.get("type_label"),
            b.get("description"),
            json.dumps(props, ensure_ascii=False),
            d.get("source_url"),
            props.get("Вейджер") or props.get("Вейджер:"),
            props.get("Мин. депозит") or props.get("Мин. депозит:"),
            props.get("Макс. сумма") or props.get("Фриспины"),
          ),
        )
        n += 1
  return n


def import_reviews(conn: psycopg.Connection) -> int:
  n = 0
  for f in sorted((DATA / "reviews").glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    slug = d.get("casino_slug") or f.stem.replace("otzyvy-", "")
    cid = casino_id(conn, slug)
    if not cid:
      cid = casino_id(conn, slug.replace("casino-", "")) or casino_id(conn, f"casino-{slug}")
    if not cid:
      print("skip reviews, no casino", slug)
      continue
    for r in d.get("reviews") or []:
      body = r.get("body") or ""
      if len(body) < 20:
        continue
      bh = hashlib.md5(body.encode()).hexdigest()
      stars = int(round(float(r["stars"]))) if r.get("stars") is not None else 5
      stars = max(1, min(5, stars))
      with conn.cursor() as cur:
        cur.execute(
          "select 1 from reviews where casino_id = %s and body_hash = %s limit 1",
          (cid, bh),
        )
        if cur.fetchone():
          continue
        cur.execute(
          """
          insert into reviews (
            casino_id, rating, body, status, source, source_url,
            author_name, author_rank, date_text, body_hash, published_at, locale
          ) values (
            %s,%s,%s,'approved','casino.ru',%s,
            %s,%s,%s,%s, now(), 'ru'
          )
          """,
          (
            cid,
            stars,
            body,
            d.get("source_url"),
            r.get("author"),
            r.get("user_rank"),
            r.get("date_text"),
            bh,
          ),
        )
        n += 1
  return n


def main() -> None:
  with psycopg.connect(DSN) as conn:
    conn.execute("select 1")
    nc = import_casinos(conn)
    conn.commit()
    print("casinos upserted:", nc)
    nb = import_bonuses(conn)
    conn.commit()
    print("bonuses inserted:", nb)
    nr = import_reviews(conn)
    conn.commit()
    print("reviews inserted:", nr)


if __name__ == "__main__":
  main()

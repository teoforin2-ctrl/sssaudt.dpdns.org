#!/usr/bin/env python3
"""Replace xreviewer content tables with data from legacy casino_portal (_old)."""

from __future__ import annotations

import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

OLD_DSN = os.environ.get(
  "OLD_DATABASE_URL",
  "postgresql://postgres:postgres@127.0.0.1:55432/casino_portal",
)
NEW_DSN = os.environ.get(
  "DATABASE_URL",
  "postgresql://xreviewer:xreviewer@127.0.0.1:5435/xreviewer",
)

BONUS_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

CATEGORY_KIND = {
  "для новичков": "guide",
  "аналитика": "analytics",
  "обзоры": "guide",
  "новости": "news",
}

VOLATILITY = {
  "высокая": "high",
  "низкая": "low",
  "средняя": "medium",
  "high": "high",
  "low": "low",
  "medium": "medium",
}


def slugify(s: str) -> str:
  s = s.strip().lower()
  s = re.sub(r"[^a-z0-9а-яё\-]+", "-", s, flags=re.I)
  s = re.sub(r"-+", "-", s).strip("-")
  return s or "author"


def parse_json_list(raw: Any) -> list[str]:
  if raw is None:
    return []
  if isinstance(raw, list):
    return [str(x).strip() for x in raw if str(x).strip()]
  if isinstance(raw, str):
    raw = raw.strip()
    if not raw:
      return []
    try:
      val = json.loads(raw)
      if isinstance(val, list):
        return [str(x).strip() for x in val if str(x).strip()]
    except json.JSONDecodeError:
      pass
    return [p.strip() for p in raw.split(",") if p.strip()]
  return []


def map_review_status(status: str) -> str:
  return {
    "Published": "approved",
    "Pending": "pending",
    "Rejected": "rejected",
    "Hidden": "rejected",
    "Deleted": "rejected",
  }.get(status, "pending")


def map_bonus_source(source: str) -> str:
  return {
    "legacy": "legacy_portal",
    "admin": "manual_editor",
    "representative": "partner",
    "automatic": "auto_import",
  }.get(source or "legacy", "legacy_portal")


def ensure_author(cur, name: str, cache: dict[str, str]) -> str:
  key = name.strip() or "Редакция"
  if key in cache:
    return cache[key]
  slug = slugify(key)
  cur.execute(
    """
    insert into authors (slug, name, role_ru, role_en, is_seed)
    values (%s, %s, 'Редакция', 'Editorial', true)
    on conflict (slug) do update set name = excluded.name
    returning id
    """,
    (slug, key),
  )
  author_id = str(cur.fetchone()[0])
  cache[key] = author_id
  return author_id


def ensure_game_provider(cur, name: str, cache: dict[str, str]) -> str | None:
  key = (name or "").strip()
  if not key:
    return None
  if key in cache:
    return cache[key]
  slug = slugify(key)[:64] or "provider"
  cur.execute(
    """
    insert into game_providers (slug, name, status)
    values (%s, %s, 'published')
    on conflict (slug) do update set name = excluded.name
    returning id
    """,
    (slug, key),
  )
  pid = str(cur.fetchone()[0])
  cache[key] = pid
  return pid


def clear_content(cur) -> None:
  cur.execute("update users set casino_id = null where casino_id is not null")
  cur.execute("delete from reward_intents")
  cur.execute("delete from go_clicks")
  cur.execute("delete from slot_casinos")
  cur.execute("delete from casino_payment_methods")
  cur.execute("delete from casino_providers")
  cur.execute("delete from promo_banners")
  cur.execute("delete from reviews")
  cur.execute("delete from bonuses")
  cur.execute("delete from articles")
  cur.execute("delete from slots")
  cur.execute("delete from casinos")
  # keep reference catalogs; slots will re-link providers


def import_all() -> None:
  print(f"OLD: {OLD_DSN}")
  print(f"NEW: {NEW_DSN}")

  with psycopg.connect(OLD_DSN) as old, psycopg.connect(NEW_DSN) as new:
    old.row_factory = psycopg.rows.dict_row
    with old.cursor() as oc, new.cursor() as nc:
      print("Clearing current content…")
      clear_content(nc)

      # ── Casinos ──────────────────────────────────────────────────
      oc.execute('select * from "Casinos" order by "SortOrder", "Name"')
      casinos = oc.fetchall()
      slug_to_id: dict[str, str] = {}
      print(f"Importing {len(casinos)} casinos…")
      for c in casinos:
        cid = str(c["Id"])
        slug = c["Slug"]
        slug_to_id[slug] = cid
        features = parse_json_list(c.get("Features"))
        badges = parse_json_list(c.get("Badges"))
        countries = parse_json_list(c.get("Countries"))
        languages = parse_json_list(c.get("Languages")) or ["ru", "en"]
        platforms = parse_json_list(c.get("Platforms")) or ["web"]
        payments = parse_json_list(c.get("PaymentMethods"))
        logo = (c.get("LogoUrl") or "").strip() or None
        rating = float(c["Rating"] or 0)
        published = bool(c["IsPublished"])
        body = (c.get("ReviewBody") or "").strip()
        short = body.split("\n", 1)[0][:280] if body else None
        info = {
          "bonus": c.get("Bonus") or "",
          "promocode": c.get("Promocode") or "",
          "badges": badges,
          "features": features,
          "tileFrom": c.get("TileFrom"),
          "tileTo": c.get("TileTo"),
          "scores": {
            "reliability": float(c["ScoreReliability"] or 0),
            "speed": float(c["ScoreSpeed"] or 0),
            "payout": float(c["ScorePayout"] or 0),
            "players": float(c["ScorePlayers"] or 0),
          },
          "crypto": bool(c.get("Crypto")),
          "reviewsDisplay": int(c.get("Reviews") or 0),
          "seoTitle": c.get("SeoTitle") or "",
          "seoDescription": c.get("SeoDescription") or "",
          "contentFormat": c.get("ContentFormat") or "legacy",
          "payments": payments,
        }
        nc.execute(
          """
          insert into casinos (
            id, slug, name, name_ru, name_en, logo_url, license,
            editorial_score, base_rating, final_rating, player_score,
            has_representative, partner_url, go_urls,
            status, published, source, source_url, external_slug,
            short_desc_ru, short_desc_en, description_ru, description_en,
            og_description, info_json, languages, countries_allowed, platforms,
            hot, sort_order, created_at, updated_at
          ) values (
            %s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,
            %s,%s,%s,
            %s,%s,'legacy_portal',%s,%s,
            %s,%s,%s,%s,
            %s,%s,%s,%s,%s,
            %s,%s,%s,now()
          )
          """,
          (
            cid,
            slug,
            c["Name"],
            c["Name"],
            c["Name"],
            logo,
            c.get("License") or None,
            rating,
            rating,
            rating,
            float(c["ScorePlayers"] or 0) or None,
            bool(c.get("HasRep")),
            (c.get("AffiliateUrl") or "").strip() or None,
            [],
            "published" if published else "draft",
            published,
            (c.get("SourceUrl") or "").strip() or None,
            slug,
            short,
            short,
            body or None,
            body or None,
            (c.get("SeoDescription") or "").strip() or short,
            Jsonb(info),
            languages if languages else ["ru", "en"],
            countries,
            platforms if platforms else ["web"],
            int(c.get("SortOrder") or 999) <= 5,
            int(c.get("SortOrder") or 0),
            c.get("CreatedAt") or datetime.now(timezone.utc),
          ),
        )

      # ── Bonuses ──────────────────────────────────────────────────
      oc.execute('select * from "Bonuses"')
      bonuses = oc.fetchall()
      print(f"Importing {len(bonuses)} bonuses…")
      skipped_bonuses = 0
      for b in bonuses:
        casino_id = slug_to_id.get(b["CasinoSlug"])
        if not casino_id:
          skipped_bonuses += 1
          continue
        bid = str(uuid.uuid5(BONUS_NS, str(b["Id"])))
        active = bool(b.get("IsActive")) and not bool(b.get("IsManuallyHidden"))
        title = b["Title"]
        promo = (b.get("Promocode") or "").strip() or None
        percent = b.get("DepositBonusPercent")
        nc.execute(
          """
          insert into bonuses (
            id, casino_id, title, title_ru, title_en, promo_code, published,
            created_at, type, amount_or_percent, wager, min_deposit,
            source, status, checked_by_editor, checked_at,
            is_percent_deposit, percent_value, source_url,
            description, description_ru, description_en, props_json
          ) values (
            %s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,
            %s,%s,%s,%s,
            %s,%s,%s,
            %s,%s,%s,%s
          )
          """,
          (
            bid,
            casino_id,
            title,
            title,
            title,
            promo,
            active,
            b.get("CreatedAt") or datetime.now(timezone.utc),
            b.get("Type") or None,
            (b.get("Size") or "").strip() or None,
            (b.get("Wager") or "").strip() or None,
            (b.get("MinDeposit") or "").strip() or None,
            map_bonus_source(b.get("Source") or "legacy"),
            "active" if active else "hidden",
            True,
            b.get("UpdatedAt") or b.get("CreatedAt"),
            bool(b.get("IsAffiliate")) and percent is not None,
            float(percent) if percent is not None else None,
            (b.get("SourceUrl") or "").strip() or None,
            (b.get("Description") or "").strip() or (b.get("Conditions") or "").strip() or None,
            (b.get("Description") or "").strip() or (b.get("Conditions") or "").strip() or None,
            (b.get("Description") or "").strip() or (b.get("Conditions") or "").strip() or None,
            Jsonb(
              {
                "legacyId": b["Id"],
                "casinoName": b.get("Casino"),
                "freespins": b.get("Freespins"),
                "expiresIn": b.get("ExpiresIn"),
                "conditions": b.get("Conditions"),
                "isAffiliate": bool(b.get("IsAffiliate")),
              }
            ),
          ),
        )

      # Card offer bonuses from casino.Bonus when casino has none active
      ensured = 0
      for c in casinos:
        offer = (c.get("Bonus") or "").strip()
        if not offer:
          continue
        cid = str(c["Id"])
        nc.execute(
          "select 1 from bonuses where casino_id = %s and status = 'active' and published = true limit 1",
          (cid,),
        )
        if nc.fetchone():
          continue
        promo = (c.get("Promocode") or "").strip() or None
        bid = str(uuid.uuid5(BONUS_NS, f"card:{c['Slug']}"))
        nc.execute(
          """
          insert into bonuses (
            id, casino_id, title, title_ru, title_en, promo_code, published,
            type, source, status, checked_by_editor, checked_at
          ) values (%s,%s,%s,%s,%s,%s,true,'Приветственный','legacy_portal','active',true,now())
          """,
          (bid, cid, offer, offer, offer, promo),
        )
        ensured += 1

      # ── Articles ─────────────────────────────────────────────────
      oc.execute('select * from "Articles" order by "PublishedDate" desc')
      articles = oc.fetchall()
      author_cache: dict[str, str] = {}
      print(f"Importing {len(articles)} articles…")
      for a in articles:
        author_id = ensure_author(nc, a.get("Author") or "Редакция", author_cache)
        cat = (a.get("Category") or "").strip()
        kind = CATEGORY_KIND.get(cat.lower(), "guide")
        title = a["Title"]
        excerpt = a.get("Excerpt") or ""
        body = a.get("Body") or ""
        nc.execute(
          """
          insert into articles (
            id, slug, kind, topic, title_ru, title_en, excerpt_ru, excerpt_en,
            body_md_ru, body_md_en, author_id, published_at, updated_at,
            cover_theme, reading_minutes, status
          ) values (
            %s,%s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,now(),
            %s,%s,%s
          )
          """,
          (
            str(a["Id"]),
            a["Slug"],
            kind,
            cat or None,
            title,
            title,
            excerpt,
            excerpt,
            body,
            body,
            author_id,
            a.get("PublishedDate") or datetime.now(timezone.utc),
            kind if kind in ("guide", "news", "analytics") else "guide",
            int(a.get("ReadTime") or 5),
            "published" if a.get("IsPublished") else "draft",
          ),
        )

      # ── Player reviews ───────────────────────────────────────────
      oc.execute('select * from "PlayerReviews"')
      reviews = oc.fetchall()
      print(f"Importing {len(reviews)} reviews…")
      skipped_reviews = 0
      for r in reviews:
        casino_id = slug_to_id.get(r["CasinoSlug"])
        if not casino_id:
          skipped_reviews += 1
          continue
        rating = int(round(float(r["Rating"])))
        rating = max(1, min(5, rating))
        status = map_review_status(r.get("Status") or "Pending")
        nc.execute(
          """
          insert into reviews (
            id, casino_id, rating, body, status, created_at, published_at,
            locale, source, author_name, origin, is_seed, language
          ) values (
            %s,%s,%s,%s,%s,%s,%s,
            'ru','legacy_portal',%s,'ugc',true,'ru'
          )
          """,
          (
            str(r["Id"]),
            casino_id,
            rating,
            r["Body"],
            status,
            r.get("CreatedAt") or datetime.now(timezone.utc),
            r.get("PublishedAt") if status == "approved" else None,
            r.get("AuthorName") or "Игрок",
          ),
        )

      # ── Slots ────────────────────────────────────────────────────
      oc.execute('select * from "Slots" order by "SortOrder"')
      slots = oc.fetchall()
      provider_cache: dict[str, str] = {}
      print(f"Importing {len(slots)} slots…")
      for s in slots:
        vol = VOLATILITY.get((s.get("Volatility") or "").strip().lower(), "medium")
        tags = parse_json_list(s.get("Tags"))
        provider_id = ensure_game_provider(nc, s.get("Provider") or "", provider_cache)
        body = (s.get("ReviewBody") or "").strip() or None
        year = s.get("Year")
        release = f"{year}-01-01" if year else None
        nc.execute(
          """
          insert into slots (
            id, slug, title, provider_id, theme, mechanics, release_date,
            rtp, volatility, description_ru, description_en, demo_url,
            status, created_at
          ) values (
            %s,%s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,
            %s,%s
          )
          """,
          (
            str(s["Id"]),
            s["Slug"],
            s["Name"],
            provider_id,
            "fruits",
            tags,
            release,
            round(float(s["Rtp"]), 1) if s.get("Rtp") is not None else None,
            vol,
            body,
            body,
            s.get("DemoUrl"),
            "published" if s.get("IsPublished") else "draft",
            datetime.now(timezone.utc),
          ),
        )

      # ── Promo ticker → promo_banners ─────────────────────────────
      oc.execute('select * from "PromoTickerItems" order by "SortOrder"')
      promos = oc.fetchall()
      print(f"Importing {len(promos)} promo banners…")
      themes = ["amber", "emerald", "sky", "rose", "violet", "orange", "teal", "indigo"]
      for i, p in enumerate(promos):
        # fuzzy match casino by name
        casino_id = None
        name = (p.get("Casino") or "").strip()
        for slug, cid in slug_to_id.items():
          # find by name match from casinos list
          pass
        oc2_name = name.lower()
        for c in casinos:
          if c["Name"].lower() == oc2_name or oc2_name in c["Name"].lower() or c["Name"].lower() in oc2_name:
            casino_id = str(c["Id"])
            break
        if casino_id is None:
          # try slugify
          casino_id = slug_to_id.get(slugify(name))
        title = f"{p['Casino']}: {p['Offer']}"
        if p.get("Code"):
          title = f"{title} · {p['Code']}"
        nc.execute(
          """
          insert into promo_banners (
            id, casino_id, title_ru, title_en, theme, active
          ) values (%s,%s,%s,%s,%s,%s)
          """,
          (
            str(p["Id"]),
            casino_id,
            title,
            title,
            themes[i % len(themes)],
            bool(p.get("IsActive")),
          ),
        )

      new.commit()
      print("Done.")
      print(f"  casinos: {len(casinos)}")
      print(f"  bonuses: {len(bonuses) - skipped_bonuses} (skipped {skipped_bonuses})")
      print(f"  card-offer bonuses ensured: {ensured}")
      print(f"  articles: {len(articles)}")
      print(f"  reviews: {len(reviews) - skipped_reviews} (skipped {skipped_reviews})")
      print(f"  slots: {len(slots)}")
      print(f"  promo_banners: {len(promos)}")


def main() -> int:
  try:
    import_all()
  except Exception as e:
    print(f"IMPORT FAILED: {e}", file=sys.stderr)
    raise
  return 0


if __name__ == "__main__":
  raise SystemExit(main())

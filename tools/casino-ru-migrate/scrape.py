#!/usr/bin/env python3
"""
Casino.ru → JSON migrator (own site, business-approved).

Usage:
  python scrape.py sitemaps
  python scrape.py pilot          # 8 casinos smoke
  python scrape.py casinos [--limit N] [--offset N]
  python scrape.py reviews [--limit N]
  python scrape.py bonuses [--limit N]
  python scrape.py images         # download logos from casinos JSON
  python scrape.py all [--limit N]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "casino-ru"
SITEMAPS = DATA / "sitemaps"
JSON_DIR = DATA / "json"
IMG_DIR = DATA / "images"
RAW_DIR = DATA / "raw"

BASE = "https://casino.ru"
UA = (
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 "
  "x-reviewer-migrator/0.1"
)
SITEMAP_FILES = [
  f"{BASE}/xml/casino-sitemap-0.xml",
  f"{BASE}/xml/casino-sitemap-1.xml",
  f"{BASE}/xml/casino-sitemap-2.xml",
]


def client() -> httpx.Client:
  return httpx.Client(
    headers={"User-Agent": UA, "Accept-Language": "ru-RU,ru;q=0.9"},
    follow_redirects=True,
    timeout=60.0,
  )


def fetch(c: httpx.Client, url: str, retries: int = 4) -> str:
  last: Exception | None = None
  for i in range(retries):
    try:
      r = c.get(url)
      if r.status_code in (403, 429, 503):
        time.sleep(2 + i * 2)
        continue
      r.raise_for_status()
      return r.text
    except Exception as e:
      last = e
      time.sleep(1.5 + i)
  raise RuntimeError(f"fetch failed {url}: {last}")


def slug_from_url(url: str) -> str:
  path = urlparse(url).path.strip("/")
  return path.split("/")[-1] if path else ""


def classify_url(url: str) -> str:
  slug = slug_from_url(url)
  if slug.startswith("otzyvy-"):
    return "reviews"
  if slug.startswith("bonusy-"):
    return "bonuses"
  if slug.startswith(("turniry-", "cashback-", "poleznoe-")):
    return "other"
  return "casino"


def casino_key_from_related(url: str, kind: str) -> str:
  """Map otzyvy-X / bonusy-X back to a stable casino slug guess."""
  s = slug_from_url(url)
  if kind == "reviews":
    s = re.sub(r"^otzyvy-", "", s)
  elif kind == "bonuses":
    s = re.sub(r"^bonusy-", "", s)
  s = re.sub(r"^casino-", "", s)
  return s


def save_json(path: Path, data: Any) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_index() -> dict[str, Any]:
  p = JSON_DIR / "meta" / "url_index.json"
  if p.exists():
    return json.loads(p.read_text(encoding="utf-8"))
  return {}


def cmd_sitemaps(c: httpx.Client) -> dict[str, Any]:
  SITEMAPS.mkdir(parents=True, exist_ok=True)
  all_urls: list[str] = []
  for i, sm in enumerate(SITEMAP_FILES):
    xml = fetch(c, sm)
    (SITEMAPS / f"casino-sitemap-{i}.xml").write_text(xml, encoding="utf-8")
    locs = re.findall(r"<loc>(https://casino\.ru/[^<]+)</loc>", xml)
    all_urls.extend(locs)
    print(f"sitemap {i}: {len(locs)} urls")

  buckets: dict[str, list[str]] = {"casino": [], "reviews": [], "bonuses": [], "other": []}
  for u in all_urls:
    buckets[classify_url(u)].append(u)

  # link related pages by casino key
  casino_map: dict[str, dict[str, str]] = {}
  for u in buckets["casino"]:
    key = casino_key_from_related(u, "casino")
    casino_map.setdefault(key, {})["casino"] = u
    casino_map[key]["slug"] = slug_from_url(u)
  for u in buckets["reviews"]:
    key = casino_key_from_related(u, "reviews")
    casino_map.setdefault(key, {})["reviews"] = u
  for u in buckets["bonuses"]:
    key = casino_key_from_related(u, "bonuses")
    casino_map.setdefault(key, {})["bonuses"] = u

  index = {
    "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "counts": {k: len(v) for k, v in buckets.items()},
    "urls": buckets,
    "casinos": casino_map,
  }
  save_json(JSON_DIR / "meta" / "url_index.json", index)
  print("index casinos:", len(casino_map), "counts:", index["counts"])
  return index


def text(el) -> str | None:
  if not el:
    return None
  t = el.get_text(" ", strip=True)
  return t or None


def abs_url(url: str | None) -> str | None:
  if not url:
    return None
  if url.startswith("//"):
    return "https:" + url
  if url.startswith("/"):
    return urljoin(BASE, url)
  if url.startswith("data:"):
    return None
  return url


def parse_info_block(soup: BeautifulSoup) -> dict[str, Any]:
  info: dict[str, Any] = {}
  block = soup.select_one(".casino-all-info, .casino-all-info-inner")
  if not block:
    return info
  # label/value pairs often as consecutive text — try dt/dd or labeled rows
  rows = block.select("tr")
  if rows:
    for tr in rows:
      cells = tr.find_all(["th", "td"])
      if len(cells) >= 2:
        info[cells[0].get_text(" ", strip=True)] = cells[1].get_text(" ", strip=True)
    return info

  # fallback: split lines like "Владелец\nKatch..."
  lines = [ln.strip() for ln in block.get_text("\n", strip=True).split("\n") if ln.strip()]
  labels = {
    "Владелец", "Платформа", "Лицензия", "Год основания", "Виды игр", "Провайдеры",
    "Платежные системы", "Валюты", "Языки", "Минимальный депозит",
  }
  i = 0
  while i < len(lines):
    if lines[i] in labels and i + 1 < len(lines):
      key = lines[i]
      vals = []
      i += 1
      while i < len(lines) and lines[i] not in labels:
        vals.append(lines[i])
        i += 1
      info[key] = vals if len(vals) > 1 else (vals[0] if vals else None)
    else:
      i += 1
  return info


def parse_bonuses_on_page(soup: BeautifulSoup) -> list[dict[str, Any]]:
  out = []
  for b in soup.select(".bonus-item"):
    props = {}
    for p in b.select(".bonus-item__prop"):
      lab = p.select_one(".bonus-item__prop-label")
      val = p.select_one(".bonus-item__prop-value")
      if lab and val:
        props[lab.get_text(strip=True).rstrip(":")] = val.get_text(strip=True)
    code_el = b.select_one("[data-promocode]") or b.select_one(".bonus-item__code-inside")
    code = None
    if code_el:
      code = code_el.get("data-promocode") or code_el.get_text(strip=True)
    types = [c.replace("bonus-item--", "") for c in (b.get("class") or []) if c.startswith("bonus-item--")]
    out.append({
      "title": text(b.select_one(".bonus-item__title")),
      "type_label": text(b.select_one(".bonus-item__type")),
      "types": types,
      "promo_code": code,
      "description": text(b.select_one(".bonus-item__description-text")),
      "props": props,
    })
  return out


def parse_casino_html(url: str, html: str) -> dict[str, Any]:
  soup = BeautifulSoup(html, "lxml")
  og = {}
  for m in soup.find_all("meta"):
    prop = m.get("property") or m.get("name")
    if prop and m.get("content"):
      og[prop] = m["content"]

  ld = None
  for s in soup.find_all("script", attrs={"type": "application/ld+json"}):
    try:
      data = json.loads(s.string or "")
    except Exception:
      continue
    if isinstance(data, dict) and data.get("@type") in ("Game", "Organization", "Product", "Article"):
      ld = data
      break

  logo = None
  for sel in [
    ".casino__picture img", ".brand__logo img", ".header__bonus-logo-image",
    ".oc__logo img", ".item__logo img",
  ]:
    img = soup.select_one(sel)
    if img:
      logo = abs_url(img.get("data-src") or img.get("src"))
      if logo:
        break
  if not logo:
    logo = abs_url(og.get("og:image"))

  go_links = sorted({
    abs_url(a.get("href"))
    for a in soup.find_all("a", href=True)
    if a.get("href") and "/go/" in a["href"]
  })
  # prefer go link matching this casino slug
  slug = slug_from_url(url)
  primary_go = next((g for g in go_links if slug.replace("casino-", "") in (g or "")), go_links[0] if go_links else None)

  images = []
  for img in soup.find_all("img"):
    src = abs_url(img.get("data-src") or img.get("src"))
    if src and "wp-content/uploads" in src:
      images.append({"src": src, "alt": img.get("alt")})

  info = parse_info_block(soup)
  license_el = soup.select_one(".casino__license")
  rating_text = text(soup.select_one(".characterictics__rating, .hci__rating-text"))

  return {
    "source": "casino.ru",
    "source_url": url,
    "slug": slug,
    "name": text(soup.find("h1")),
    "og_title": og.get("og:title"),
    "og_description": og.get("og:description") or og.get("description"),
    "logo_url": logo,
    "images": images[:40],
    "go_url": primary_go,
    "go_urls": go_links,
    "rating_page": rating_text,
    "license": text(license_el) or info.get("Лицензия"),
    "info": info,
    "bonuses_on_page": parse_bonuses_on_page(soup),
    "json_ld": ld,
    "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  }


def parse_reviews_html(url: str, html: str, casino_slug: str) -> dict[str, Any]:
  soup = BeautifulSoup(html, "lxml")
  reviews = []
  for block in soup.select(".comment-list .comment__inside, .comment-list > .comment, div.comment"):
    # skip nested vote-only wrappers without content
    body_el = block.select_one(".comment-content")
    if not body_el:
      continue
    author = text(block.select_one(".comment-author__name, .comment-author"))
    rate = text(block.select_one(".comment__rate"))
    stars = None
    if rate:
      m = re.search(r"(\d+(?:[.,]\d+)?)", rate)
      if m:
        stars = float(m.group(1).replace(",", "."))
    date = text(block.select_one(".comment-published, time"))
    rank = text(block.select_one(".user-rang"))
    reviews.append({
      "author": author,
      "user_rank": rank,
      "stars": stars,
      "date_text": date,
      "body": body_el.get_text("\n", strip=True),
    })

  # de-dupe identical bodies
  seen = set()
  uniq = []
  for r in reviews:
    h = hashlib.md5((r.get("body") or "").encode()).hexdigest()
    if h in seen:
      continue
    seen.add(h)
    uniq.append(r)

  return {
    "source": "casino.ru",
    "source_url": url,
    "casino_slug": casino_slug,
    "title": text(soup.find("h1")),
    "reviews": uniq,
    "count": len(uniq),
    "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  }


def parse_bonus_page(url: str, html: str, casino_slug: str) -> dict[str, Any]:
  soup = BeautifulSoup(html, "lxml")
  return {
    "source": "casino.ru",
    "source_url": url,
    "casino_slug": casino_slug,
    "title": text(soup.find("h1")),
    "og_description": None,
    "bonuses": parse_bonuses_on_page(soup),
    "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  }


def scrape_list(
  c: httpx.Client,
  kind: str,
  limit: int | None,
  offset: int,
  delay: float,
  save_raw: bool,
) -> None:
  index = load_index()
  if not index:
    index = cmd_sitemaps(c)

  items = list(index.get("casinos", {}).items())
  items = items[offset: (offset + limit) if limit else None]
  print(f"scrape {kind}: {len(items)} casinos (offset={offset})")

  out_dir = JSON_DIR / ("casinos" if kind == "casino" else kind)
  out_dir.mkdir(parents=True, exist_ok=True)

  ok = fail = skip = 0
  for key, meta in items:
    url = meta.get("casino" if kind == "casino" else kind)
    slug = meta.get("slug") or key
    if not url:
      skip += 1
      continue
    out = out_dir / f"{slug}.json"
    if out.exists() and out.stat().st_size > 50:
      skip += 1
      continue
    try:
      html = fetch(c, url)
      if save_raw:
        (RAW_DIR / kind).mkdir(parents=True, exist_ok=True)
        (RAW_DIR / kind / f"{slug}.html").write_text(html, encoding="utf-8")
      if kind == "casino":
        data = parse_casino_html(url, html)
      elif kind == "reviews":
        data = parse_reviews_html(url, html, slug)
      else:
        data = parse_bonus_page(url, html, slug)
      data["casino_key"] = key
      save_json(out, data)
      ok += 1
      print(f"  OK {kind} {slug} ({data.get('count') or data.get('name') or ''})")
    except Exception as e:
      fail += 1
      print(f"  FAIL {kind} {slug}: {e}")
    time.sleep(delay)

  print(f"done {kind}: ok={ok} skip={skip} fail={fail}")


def cmd_images(limit: int | None = None) -> None:
  files = sorted((JSON_DIR / "casinos").glob("*.json"))
  if limit:
    files = files[:limit]
  IMG_DIR.mkdir(parents=True, exist_ok=True)
  with client() as c:
    for f in files:
      data = json.loads(f.read_text(encoding="utf-8"))
      slug = data.get("slug") or f.stem
      logo = data.get("logo_url")
      if not logo:
        continue
      ext = Path(urlparse(logo).path).suffix or ".jpg"
      dest = IMG_DIR / "logos" / f"{slug}{ext}"
      dest.parent.mkdir(parents=True, exist_ok=True)
      if dest.exists():
        continue
      try:
        r = c.get(logo)
        r.raise_for_status()
        dest.write_bytes(r.content)
        data["logo_local"] = str(dest.relative_to(DATA))
        save_json(f, data)
        print("logo", slug, dest.name)
      except Exception as e:
        print("logo FAIL", slug, e)
      time.sleep(0.2)


def main() -> None:
  ap = argparse.ArgumentParser()
  ap.add_argument("command", choices=["sitemaps", "pilot", "casinos", "reviews", "bonuses", "images", "all"])
  ap.add_argument("--limit", type=int, default=None)
  ap.add_argument("--offset", type=int, default=0)
  ap.add_argument("--delay", type=float, default=0.7)
  ap.add_argument("--raw", action="store_true")
  args = ap.parse_args()

  with client() as c:
    # warm cookies / ddos-guard
    try:
      fetch(c, BASE + "/")
    except Exception as e:
      print("warm failed", e)

    if args.command == "sitemaps":
      cmd_sitemaps(c)
      return

    if args.command == "pilot":
      args.limit = args.limit or 8
      cmd_sitemaps(c)
      for kind in ("casino", "reviews", "bonuses"):
        scrape_list(c, kind, args.limit, 0, args.delay, args.raw)
      cmd_images(args.limit)
      return

    if args.command == "sitemaps":
      cmd_sitemaps(c)
    elif args.command in ("casinos", "reviews", "bonuses"):
      kind = "casino" if args.command == "casinos" else args.command
      if not load_index():
        cmd_sitemaps(c)
      scrape_list(c, kind, args.limit, args.offset, args.delay, args.raw)
    elif args.command == "images":
      cmd_images(args.limit)
    elif args.command == "all":
      cmd_sitemaps(c)
      for kind in ("casino", "reviews", "bonuses"):
        scrape_list(c, kind, args.limit, args.offset, args.delay, args.raw)
      cmd_images(args.limit)


if __name__ == "__main__":
  main()

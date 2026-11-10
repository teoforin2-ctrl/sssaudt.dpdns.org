#!/usr/bin/env python3
"""Import forum categories/topics/posts from portal dump (+ enrich missing first posts)."""

from __future__ import annotations

import json
import re
import subprocess
import uuid
from pathlib import Path

DUMP = Path(__file__).with_name("forum_dump.json")
XR = "postgresql://xreviewer:xreviewer@127.0.0.1:5435/xreviewer"

# Full thread for the flagship complaint topic (from _old / live site).
THREAD_POSTS = [
    {
        "author": "Marina_K",
        "badge": None,
        "body": [
            "Здравствуйте. Уже третий день жду вывод 50 000 ₽ из Pokerdom через СБП. Все документы прошли верификацию ещё на старте, аккаунт активен 8 месяцев.",
            "Казино: Pokerdom",
            "Сумма: 50 000 ₽",
            "Дата заявки: 13.06.2026, 09:14",
            "Способ: СБП",
            'В саппорте отвечают шаблонно — "в обработке". Скриншот заявки прилагаю. Подскажите, кто сталкивался: ждать или эскалировать?',
        ],
        "quote_author": None,
        "quote_text": None,
        "helpful": 12,
    },
    {
        "author": "AlexG",
        "badge": "Азартный гуру",
        "body": [
            'У меня в апреле было то же самое — висело 4 дня. Помогло написать в чат с пометкой "финансовый отдел" и приложить скрин заявки. Через 6 часов вывели.',
        ],
        "quote_author": None,
        "quote_text": None,
        "helpful": 8,
    },
    {
        "author": "Модератор Анна",
        "badge": "Модератор",
        "body": [
            "Закрепляю тему. Тегаю официального представителя Pokerdom — @PokerdomOfficial, прокомментируйте, пожалуйста.",
            "Напоминаю всем участникам: оскорбления в адрес саппорта удаляются, факты — приветствуются.",
        ],
        "quote_author": None,
        "quote_text": None,
        "helpful": 5,
    },
    {
        "author": "PokerdomOfficial",
        "badge": "Представитель казино",
        "body": [
            "Marina_K, добрый день. Запросили статус вашей заявки в финансовом отделе. Напишите, пожалуйста, в личные сообщения номер заявки и логин — посмотрим в приоритете.",
            "Стандартный срок СБП — до 24 часов, но в выходные возможны задержки на стороне банка-эквайера. Разберёмся.",
        ],
        "quote_author": None,
        "quote_text": None,
        "helpful": 14,
    },
    {
        "author": "Marina_K",
        "badge": None,
        "body": [
            'UPD: представитель ответил в личке, через 40 минут вывод пришёл. Спасибо! Меняю статус темы на "Resolved".',
        ],
        "quote_author": "PokerdomOfficial",
        "quote_text": "Marina_K, добрый день. Запросили статус вашей заявки...",
        "helpful": 22,
    },
]

CAT_EN = {
    "online-kazino": ("Online casinos", "Discussions of venues, licences and new releases"),
    "zhaloby": ("Casino complaints", "Payout delays, account locks, disputed cases"),
    "bonusy": ("Bonuses", "Promo codes, editorial exclusives, wagering terms"),
    "sloty": ("Slots", "Favourite games, RTP talk, provider releases"),
    "offtop": ("Off-topic", "Free chat unrelated to casinos"),
    "novosti": ("Industry news", "Regulation, licences, market events"),
}


def sql_str(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def sql_json(v) -> str:
    return sql_str(json.dumps(v, ensure_ascii=False))


def parse_list(raw) -> list:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return [str(raw)]


def body_md(parts: list[str]) -> str:
    return "\n\n".join(p.strip() for p in parts if p and str(p).strip())


def run_sql(sql: str) -> None:
    subprocess.run(
        ["psql", XR, "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True,
        capture_output=True,
        text=True,
    )


def main() -> None:
    data = json.loads(DUMP.read_text())
    cats = data["categories"]
    topics = data["topics"]
    posts = data["posts"]

    # Apply migration first
    mig = Path(__file__).resolve().parents[2] / "docker/postgres/migrations/012_forum.sql"
    subprocess.run(["psql", XR, "-v", "ON_ERROR_STOP=1", "-f", str(mig)], check=True)

    run_sql("truncate forum_posts, forum_topics, forum_categories cascade")

    cat_id_by_slug: dict[str, str] = {}
    for c in cats:
        cid = c["Id"]
        slug = c["Slug"]
        en_title, en_desc = CAT_EN.get(slug, (c["Title"], c["Description"]))
        cat_id_by_slug[slug] = cid
        run_sql(
            f"""
            insert into forum_categories (
              id, slug, icon, title_ru, title_en, description_ru, description_en, sort_order, status
            ) values (
              {sql_str(cid)}, {sql_str(slug)}, {sql_str(c.get('Icon') or '')},
              {sql_str(c['Title'])}, {sql_str(en_title)},
              {sql_str(c.get('Description') or '')}, {sql_str(en_desc)},
              {int(c.get('SortOrder') or 0)}, 'published'
            )
            """
        )

    topic_id_by_slug: dict[str, str] = {}
    for t in topics:
        slug = t["Slug"]
        cslug = t.get("CategorySlug") or ""
        cid = cat_id_by_slug.get(cslug)
        if not cid:
            # fallback by category title
            for c in cats:
                if c["Title"] == t.get("Category"):
                    cid = c["Id"]
                    break
        if not cid:
            print("skip topic without category", slug)
            continue
        tid = t["Id"]
        topic_id_by_slug[slug] = tid
        tags = parse_list(t.get("Tags"))
        run_sql(
            f"""
            insert into forum_topics (
              id, category_id, slug, title, tags, author_name, author_badge,
              posts_count, views_count, is_locked, status, created_at, updated_at, last_post_at
            ) values (
              {sql_str(tid)}, {sql_str(cid)}, {sql_str(slug)}, {sql_str(t['Title'])},
              {sql_json(tags)}::jsonb, {sql_str(t['Author'])}, {sql_str(t.get('AuthorBadge'))},
              {int(t.get('Posts') or 0)}, {int(t.get('Views') or 0)},
              {'true' if t.get('IsLocked') else 'false'}, 'published',
              {sql_str(t.get('CreatedAt') or 'now()')}::timestamptz,
              {sql_str(t.get('CreatedAt') or 'now()')}::timestamptz,
              {sql_str(t.get('CreatedAt') or 'now()')}::timestamptz
            )
            """
        )

    # Index posts from dump (skip orphans)
    valid_topic_ids = set(topic_id_by_slug.values())
    inserted_for: set[str] = set()
    for p in posts:
        tid = p["TopicId"]
        if tid not in valid_topic_ids:
            continue
        parts = parse_list(p.get("Body"))
        md = body_md(parts) or "…"
        pid = p["Id"]
        # portal used text ids; normalize to uuid when possible else generate stable uuid5
        try:
            uuid.UUID(str(pid))
            pid_sql = sql_str(str(pid))
        except Exception:
            pid_sql = sql_str(str(uuid.uuid5(uuid.NAMESPACE_URL, f"forum-post:{pid}")))
        run_sql(
            f"""
            insert into forum_posts (
              id, topic_id, author_name, author_badge, body_md,
              quote_author, quote_text, helpful, sort_order, status, created_at
            ) values (
              {pid_sql}, {sql_str(tid)}, {sql_str(p['Author'])}, {sql_str(p.get('Badge'))},
              {sql_str(md)}, {sql_str(p.get('QuoteAuthor'))}, {sql_str(p.get('QuoteText'))},
              {int(p.get('Helpful') or 0)}, {int(p.get('SortOrder') or 0)}, 'published', now()
            )
            on conflict (id) do nothing
            """
        )
        inserted_for.add(tid)

    # Replace pokerdom thread with full 5-post conversation
    poker_id = topic_id_by_slug.get("zaderzhka-vyvoda-pokerdom")
    if poker_id:
        run_sql(f"delete from forum_posts where topic_id = {sql_str(poker_id)}")
        for i, p in enumerate(THREAD_POSTS, start=1):
            run_sql(
                f"""
                insert into forum_posts (
                  id, topic_id, author_name, author_badge, body_md,
                  quote_author, quote_text, helpful, sort_order, status, created_at
                ) values (
                  {sql_str(str(uuid.uuid5(uuid.NAMESPACE_URL, f'forum-thread-pokerdom-{i}')))},
                  {sql_str(poker_id)}, {sql_str(p['author'])}, {sql_str(p['badge'])},
                  {sql_str(body_md(p['body']))}, {sql_str(p['quote_author'])}, {sql_str(p['quote_text'])},
                  {p['helpful']}, {i}, 'published', now() - interval '{5-i} hours'
                )
                """
            )
        inserted_for.add(poker_id)

    # First posts for topics that still have none
    for t in topics:
        tid = topic_id_by_slug.get(t["Slug"])
        if not tid or tid in inserted_for:
            continue
        opener = (
            f"{t['Title']}\n\n"
            f"Открыл(а) тему: {t['Author']}. Делитесь опытом и фактами. 18+."
        )
        run_sql(
            f"""
            insert into forum_posts (
              id, topic_id, author_name, author_badge, body_md, helpful, sort_order, status, created_at
            ) values (
              {sql_str(str(uuid.uuid5(uuid.NAMESPACE_URL, f"forum-opener:{t['Slug']}")))},
              {sql_str(tid)}, {sql_str(t['Author'])}, {sql_str(t.get('AuthorBadge'))},
              {sql_str(opener)}, 0, 1, 'published',
              {sql_str(t.get('CreatedAt') or 'now()')}::timestamptz
            )
            """
        )

    # Recompute post counts from real posts
    run_sql(
        """
        update forum_topics t set
          posts_count = coalesce((
            select count(*)::int from forum_posts p
            where p.topic_id = t.id and p.status = 'published'
          ), 0),
          last_post_at = coalesce((
            select max(p.created_at) from forum_posts p
            where p.topic_id = t.id and p.status = 'published'
          ), t.created_at),
          updated_at = now()
        """
    )

    # Stats
    out = subprocess.check_output(
        [
            "psql",
            XR,
            "-t",
            "-A",
            "-c",
            "select (select count(*) from forum_categories),(select count(*) from forum_topics),(select count(*) from forum_posts)",
        ],
        text=True,
    ).strip()
    print("imported cats|topics|posts =", out)


if __name__ == "__main__":
    main()

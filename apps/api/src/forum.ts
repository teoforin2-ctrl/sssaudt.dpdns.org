import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireStaff, type AuthUser } from "./auth.js";

function langOf(req: FastifyRequest) {
  const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
  return locale.startsWith("en") ? "en" : "ru";
}

function pageParams(query: unknown) {
  const q = (query ?? {}) as { page?: string; limit?: string; q?: string; status?: string };
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  return { page, limit, offset: (page - 1) * limit, q: (q.q || "").trim(), status: (q.status || "").trim() };
}

function requireUser(req: FastifyRequest, reply: FastifyReply): AuthUser | null {
  if (!req.staffUser) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return req.staffUser;
}

async function refreshTopicCounts(pool: Pool, topicId: string) {
  await pool.query(
    `
    update forum_topics t set
      posts_count = (
        select count(*)::int from forum_posts p
        where p.topic_id = t.id and p.status = 'published'
      ),
      last_post_at = coalesce((
        select max(p.created_at) from forum_posts p
        where p.topic_id = t.id and p.status = 'published'
      ), t.created_at),
      updated_at = now()
    where t.id = $1
    `,
    [topicId],
  );
}

export async function registerForum(app: FastifyInstance, pool: Pool) {
  app.get("/v1/forum", async (req) => {
    const lang = langOf(req);
    const { rows: categories } = await pool.query(
      `
      select c.id, c.slug, c.icon,
             case when $1 = 'en' then c.title_en else c.title_ru end as title,
             case when $1 = 'en' then c.description_en else c.description_ru end as description,
             c.sort_order,
             (select count(*)::int from forum_topics t
               where t.category_id = c.id and t.status = 'published') as topics_count,
             (select count(*)::int from forum_posts p
               join forum_topics t on t.id = p.topic_id
               where t.category_id = c.id and t.status = 'published' and p.status = 'published') as posts_count,
             (
               select json_build_object('title', t.title, 'author', t.author_name, 'at', t.last_post_at, 'slug', t.slug)
               from forum_topics t
               where t.category_id = c.id and t.status = 'published'
               order by t.last_post_at desc
               limit 1
             ) as last_topic
      from forum_categories c
      where c.status = 'published'
      order by c.sort_order, c.title_ru
      `,
      [lang],
    );

    const { rows: recent } = await pool.query(
      `
      select t.id, t.slug, t.title, t.tags, t.author_name, t.author_badge,
             t.posts_count, t.views_count, t.is_locked, t.is_pinned, t.created_at, t.last_post_at,
             c.slug as category_slug,
             case when $1 = 'en' then c.title_en else c.title_ru end as category_title
      from forum_topics t
      join forum_categories c on c.id = t.category_id
      where t.status = 'published' and c.status = 'published'
      order by t.is_pinned desc, t.last_post_at desc
      limit 20
      `,
      [lang],
    );

    const { rows: stats } = await pool.query<{ topics: string; posts: string }>(
      `
      select
        (select count(*)::text from forum_topics where status = 'published') as topics,
        (select count(*)::text from forum_posts where status = 'published') as posts
      `,
    );

    return {
      locale: lang,
      stats: {
        topics: Number(stats[0]?.topics || 0),
        posts: Number(stats[0]?.posts || 0),
      },
      categories,
      recent,
    };
  });

  app.get("/v1/forum/categories/:slug", async (req, reply) => {
    const lang = langOf(req);
    const { slug } = req.params as { slug: string };
    const { page, limit, offset } = pageParams(req.query);

    const { rows: cats } = await pool.query(
      `
      select c.id, c.slug, c.icon,
             case when $1 = 'en' then c.title_en else c.title_ru end as title,
             case when $1 = 'en' then c.description_en else c.description_ru end as description
      from forum_categories c
      where c.slug = $2 and c.status = 'published'
      limit 1
      `,
      [lang, slug],
    );
    const cat = cats[0];
    if (!cat) return reply.code(404).send({ error: "not_found" });

    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from forum_topics where category_id = $1 and status = 'published'`,
      [cat.id],
    );
    const { rows: items } = await pool.query(
      `
      select t.id, t.slug, t.title, t.tags, t.author_name, t.author_badge,
             t.posts_count, t.views_count, t.is_locked, t.is_pinned, t.created_at, t.last_post_at
      from forum_topics t
      where t.category_id = $1 and t.status = 'published'
      order by t.is_pinned desc, t.last_post_at desc
      limit $2 offset $3
      `,
      [cat.id, limit, offset],
    );

    return {
      locale: lang,
      category: cat,
      items,
      total: Number(countRows[0]?.n || 0),
      page,
      limit,
    };
  });

  app.get("/v1/forum/topics/:slug", async (req, reply) => {
    const lang = langOf(req);
    const { slug } = req.params as { slug: string };
    const { page, limit, offset } = pageParams(req.query);

    const { rows } = await pool.query(
      `
      select t.*, c.slug as category_slug,
             case when $1 = 'en' then c.title_en else c.title_ru end as category_title
      from forum_topics t
      join forum_categories c on c.id = t.category_id
      where t.slug = $2 and t.status = 'published' and c.status = 'published'
      limit 1
      `,
      [lang, slug],
    );
    const topic = rows[0];
    if (!topic) return reply.code(404).send({ error: "not_found" });

    // fire-and-forget view bump
    void pool.query(`update forum_topics set views_count = views_count + 1 where id = $1`, [topic.id]);

    const { rows: countRows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from forum_posts where topic_id = $1 and status = 'published'`,
      [topic.id],
    );
    const { rows: posts } = await pool.query(
      `
      select id, author_name, author_badge, body_md, quote_author, quote_text,
             helpful, sort_order, created_at
      from forum_posts
      where topic_id = $1 and status = 'published'
      order by sort_order asc, created_at asc
      limit $2 offset $3
      `,
      [topic.id, limit, offset],
    );

    return {
      locale: lang,
      topic: {
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        tags: topic.tags,
        authorName: topic.author_name,
        authorBadge: topic.author_badge,
        postsCount: topic.posts_count,
        viewsCount: topic.views_count + 1,
        isLocked: topic.is_locked,
        isPinned: topic.is_pinned,
        createdAt: topic.created_at,
        lastPostAt: topic.last_post_at,
        categorySlug: topic.category_slug,
        categoryTitle: topic.category_title,
      },
      posts: posts.map((p) => ({
        id: p.id,
        authorName: p.author_name,
        authorBadge: p.author_badge,
        bodyMd: p.body_md,
        quoteAuthor: p.quote_author,
        quoteText: p.quote_text,
        helpful: p.helpful,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
      })),
      total: Number(countRows[0]?.n || 0),
      page,
      limit,
    };
  });

  app.post("/v1/forum/topics", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const body = z
      .object({
        categorySlug: z.string().min(1).max(80),
        title: z.string().trim().min(5).max(200),
        body: z.string().trim().min(5).max(20000),
        tags: z.array(z.string().max(40)).max(8).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: cats } = await pool.query(
      `select id from forum_categories where slug = $1 and status = 'published' limit 1`,
      [body.data.categorySlug],
    );
    if (!cats[0]) return reply.code(404).send({ error: "category_not_found" });

    const base = body.data.title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "topic";
    const slug = `${base}-${Date.now().toString(36)}`.replace(/-+/g, "-");
    const author = user.displayName || user.email.split("@")[0];

    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows: topics } = await client.query(
        `
        insert into forum_topics (
          category_id, slug, title, tags, author_name, author_user_id, posts_count, views_count, status
        ) values ($1,$2,$3,$4::jsonb,$5,$6,1,0,'published')
        returning *
        `,
        [
          cats[0].id,
          slug,
          body.data.title,
          JSON.stringify(body.data.tags || []),
          author,
          user.id,
        ],
      );
      const topic = topics[0];
      await client.query(
        `
        insert into forum_posts (topic_id, author_name, author_user_id, body_md, sort_order, status)
        values ($1,$2,$3,$4,1,'published')
        `,
        [topic.id, author, user.id, body.data.body],
      );
      await client.query("commit");
      return reply.code(201).send({ topic: { id: topic.id, slug: topic.slug } });
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/v1/forum/topics/:slug/replies", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { slug } = req.params as { slug: string };
    const body = z
      .object({
        body: z.string().trim().min(2).max(20000),
        quoteAuthor: z.string().max(120).nullable().optional(),
        quoteText: z.string().max(2000).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows } = await pool.query(
      `select id, is_locked, status from forum_topics where slug = $1 limit 1`,
      [slug],
    );
    const topic = rows[0];
    if (!topic || topic.status !== "published") return reply.code(404).send({ error: "not_found" });
    if (topic.is_locked) return reply.code(403).send({ error: "locked" });

    const author = user.displayName || user.email.split("@")[0];
    const { rows: orderRows } = await pool.query<{ n: string }>(
      `select coalesce(max(sort_order), 0)::text as n from forum_posts where topic_id = $1`,
      [topic.id],
    );
    const sortOrder = Number(orderRows[0]?.n || 0) + 1;
    const { rows: posts } = await pool.query(
      `
      insert into forum_posts (
        topic_id, author_name, author_user_id, body_md, quote_author, quote_text, sort_order, status
      ) values ($1,$2,$3,$4,$5,$6,$7,'published')
      returning id, author_name, body_md, created_at, sort_order
      `,
      [
        topic.id,
        author,
        user.id,
        body.data.body,
        body.data.quoteAuthor ?? null,
        body.data.quoteText ?? null,
        sortOrder,
      ],
    );
    await refreshTopicCounts(pool, topic.id);
    return reply.code(201).send({ post: posts[0] });
  });

  // ── Admin moderation ────────────────────────────────────────────
  app.get("/v1/admin/forum/topics", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { page, limit, offset, q, status } = pageParams(req.query);
    const params: unknown[] = [];
    const where: string[] = ["true"];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(t.title ilike $${params.length} or t.slug ilike $${params.length} or t.author_name ilike $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`t.status = $${params.length}`);
    }
    params.push(limit, offset);
    const lim = `$${params.length - 1}`;
    const off = `$${params.length}`;
    const countParams = params.slice(0, -2);
    const [{ rows: countRows }, { rows }, summaryRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from forum_topics t where ${where.join(" and ")}`,
        countParams,
      ),
      pool.query(
        `
        select t.id, t.slug, t.title, t.author_name, t.posts_count, t.views_count,
               t.is_locked, t.is_pinned, t.status, t.created_at, t.last_post_at,
               c.slug as category_slug, c.title_ru as category_title
        from forum_topics t
        join forum_categories c on c.id = t.category_id
        where ${where.join(" and ")}
        order by t.last_post_at desc
        limit ${lim} offset ${off}
        `,
        params,
      ),
      pool.query<{
        topics: string
        posts: string
        hidden: string
        locked: string
      }>(`
        select
          (select count(*)::text from forum_topics) as topics,
          (select count(*)::text from forum_posts) as posts,
          (select count(*)::text from forum_topics where status = 'hidden') as hidden,
          (select count(*)::text from forum_topics where is_locked = true) as locked
      `).catch(() => ({ rows: [] as any[] })),
    ]);
    const s = summaryRes.rows[0];
    return {
      items: rows,
      total: Number(countRows[0]?.n || 0),
      page,
      limit,
      summary: {
        topics: Number(s?.topics ?? 0),
        posts: Number(s?.posts ?? 0),
        hidden: Number(s?.hidden ?? 0),
        locked: Number(s?.locked ?? 0),
      },
    };
  });

  app.get("/v1/admin/forum/topics/:id/posts", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `
      select id, author_name, author_badge, body_md, quote_author, quote_text,
             helpful, sort_order, status, created_at
      from forum_posts
      where topic_id = $1
      order by sort_order asc, created_at asc
      `,
      [id],
    );
    return { items: rows };
  });

  app.patch("/v1/admin/forum/topics/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        status: z.enum(["published", "hidden", "deleted"]).optional(),
        is_locked: z.boolean().optional(),
        is_pinned: z.boolean().optional(),
        title: z.string().min(3).max(200).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(body.data)) {
      if (v === undefined) continue;
      values.push(v);
      fields.push(`${k} = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(new Date().toISOString());
    fields.push(`updated_at = $${values.length}`);
    values.push(id);
    const { rows } = await pool.query(
      `update forum_topics set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.patch("/v1/admin/forum/posts/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        status: z.enum(["published", "hidden", "deleted"]).optional(),
        body_md: z.string().min(1).max(20000).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(body.data)) {
      if (v === undefined) continue;
      values.push(v);
      fields.push(`${k} = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(new Date().toISOString());
    fields.push(`updated_at = $${values.length}`);
    values.push(id);
    const { rows } = await pool.query(
      `update forum_posts set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await refreshTopicCounts(pool, rows[0].topic_id);
    return { item: rows[0] };
  });

  app.delete("/v1/admin/forum/topics/:id", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from forum_topics where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });
}

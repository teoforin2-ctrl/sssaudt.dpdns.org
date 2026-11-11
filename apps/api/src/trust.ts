import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireStaff, requireLawyer, isLawyerRole } from "./auth.js";


export async function registerTrust(app: FastifyInstance, pool: Pool) {
  // —— Public: submit complaint ——
  app.post("/v1/complaints", async (req, reply) => {
    const body = z
      .object({
        casinoSlug: z.string().max(120).optional().nullable(),
        casinoName: z.string().max(200).optional().nullable(),
        authorName: z.string().trim().min(2).max(80),
        authorEmail: z.string().email().max(320),
        subject: z.string().trim().min(3).max(200),
        body: z.string().trim().min(30).max(8000),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    let casinoId: string | null = null;
    const slug = (body.data.casinoSlug || "").trim();
    if (slug) {
      const { rows } = await pool.query<{ id: string }>(
        `select id from casinos where slug = $1 limit 1`,
        [slug],
      );
      casinoId = rows[0]?.id ?? null;
    }

    const { rows } = await pool.query(
      `
      insert into complaints (
        casino_id, casino_slug, casino_name, author_name, author_email, subject, body
      ) values ($1,$2,$3,$4,$5,$6,$7)
      returning id, status, created_at
      `,
      [
        casinoId,
        slug || null,
        body.data.casinoName || null,
        body.data.authorName,
        body.data.authorEmail.toLowerCase(),
        body.data.subject,
        body.data.body,
      ],
    );
    return reply.code(201).send({ item: rows[0] });
  });

  // —— Public: published blacklist ——
  app.get("/v1/blacklist", async (req) => {
    const locale = ((req.query as { locale?: string }).locale || "ru").toLowerCase();
    const lang = locale.startsWith("en") ? "en" : "ru";
    const { rows } = await pool.query(
      `
      select id, name, slug, reason_ru, reason_en, published_at, casino_id
      from blacklist_entries
      where status = 'published'
      order by published_at desc nulls last, created_at desc
      limit 100
      `,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        reason: lang === "en" ? r.reason_en || r.reason_ru : r.reason_ru || r.reason_en,
        publishedAt: r.published_at,
        casinoId: r.casino_id,
      })),
    };
  });

  // —— Admin: complaints ——
  app.get("/v1/admin/complaints", async (req, reply) => {
    if (!requireStaff(req, reply)) return;
    const q = (req.query ?? {}) as { status?: string; page?: string; limit?: string };
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let where = "true";
    if (q.status) {
      params.push(q.status);
      where = `status = $${params.length}`;
    }
    const [{ rows: countRows }, { rows }, summaryRes] = await Promise.all([
      pool.query<{ n: string }>(
        `select count(*)::text as n from complaints where ${where}`,
        params,
      ),
      pool.query(
        `
        select *
        from complaints
        where ${where}
        order by created_at desc
        limit $${params.length + 1} offset $${params.length + 2}
        `,
        [...params, limit, offset],
      ),
      pool.query<{
        total: string
        open_n: string
        in_progress: string
        resolved: string
      }>(`
        select
          count(*)::text as total,
          count(*) filter (where status in ('new','in_review','need_info'))::text as open_n,
          count(*) filter (where status = 'in_review')::text as in_progress,
          count(*) filter (where status = 'resolved')::text as resolved
        from complaints
      `).catch(() => ({ rows: [] as any[] })),
    ]);
    const s = summaryRes.rows[0];
    return {
      items: rows,
      total: Number(countRows[0]?.n || 0),
      page,
      limit,
      summary: {
        total: Number(s?.total ?? 0),
        open: Number(s?.open_n ?? 0),
        inProgress: Number(s?.in_progress ?? 0),
        resolved: Number(s?.resolved ?? 0),
      },
    };
  });

  app.patch("/v1/admin/complaints/:id", async (req, reply) => {
    const user = requireStaff(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        status: z.enum(["new", "in_review", "need_info", "resolved", "rejected"]).optional(),
        staff_note: z.string().max(4000).nullable().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
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
    fields.push("updated_at = now()");
    if (body.data.status === "in_review" && body.data.assigned_to === undefined) {
      values.push(user.id);
      fields.push(`assigned_to = coalesce(assigned_to, $${values.length})`);
    }
    values.push(id);
    const { rows } = await pool.query(
      `update complaints set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  // —— Admin: blacklist (lawyer / admin / developer) ——
  app.get("/v1/admin/blacklist", async (req, reply) => {
    if (!requireLawyer(req, reply)) return;
    const q = (req.query ?? {}) as { status?: string };
    const params: unknown[] = [];
    let where = "true";
    if (q.status) {
      params.push(q.status);
      where = `status = $${params.length}`;
    }
    const { rows } = await pool.query(
      `select * from blacklist_entries where ${where} order by updated_at desc limit 200`,
      params,
    );
    return { items: rows };
  });

  app.post("/v1/admin/blacklist", async (req, reply) => {
    const user = requireLawyer(req, reply);
    if (!user) return;
    const body = z
      .object({
        name: z.string().trim().min(1).max(200),
        slug: z.string().max(120).nullable().optional(),
        reason_ru: z.string().max(4000).optional(),
        reason_en: z.string().max(4000).optional(),
        casino_id: z.string().uuid().nullable().optional(),
        submit_to_lawyer: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const status = body.data.submit_to_lawyer ? "pending_lawyer" : "draft";
    const { rows } = await pool.query(
      `
      insert into blacklist_entries (
        name, slug, reason_ru, reason_en, casino_id, status, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7)
      returning *
      `,
      [
        body.data.name,
        body.data.slug ?? null,
        body.data.reason_ru || "",
        body.data.reason_en || "",
        body.data.casino_id ?? null,
        status,
        user.id,
      ],
    );
    return reply.code(201).send({ item: rows[0] });
  });

  app.patch("/v1/admin/blacklist/:id", async (req, reply) => {
    const user = requireLawyer(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().trim().min(1).max(200).optional(),
        slug: z.string().max(120).nullable().optional(),
        reason_ru: z.string().max(4000).optional(),
        reason_en: z.string().max(4000).optional(),
        status: z.enum(["draft", "pending_lawyer", "published", "rejected"]).optional(),
        lawyer_note: z.string().max(2000).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    if (body.data.status === "published" && !isLawyerRole(user.role)) {
      return reply.code(403).send({ error: "lawyer_required_to_publish" });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of ["name", "slug", "reason_ru", "reason_en", "status", "lawyer_note"] as const) {
      if (body.data[key] !== undefined) {
        values.push(body.data[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }
    if (body.data.status === "published") {
      values.push(user.id);
      fields.push(`lawyer_id = $${values.length}`);
      fields.push("lawyer_approved_at = now()");
      fields.push("published_at = coalesce(published_at, now())");
    }
    if (body.data.status === "rejected") {
      values.push(user.id);
      fields.push(`lawyer_id = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    fields.push("updated_at = now()");
    values.push(id);
    const { rows } = await pool.query(
      `update blacklist_entries set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.delete("/v1/admin/blacklist/:id", async (req, reply) => {
    if (!requireLawyer(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from blacklist_entries where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });
}


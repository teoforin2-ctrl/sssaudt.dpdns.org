import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { requireAdmin, type AuthUser } from "./auth.js";

function requireKanban(req: FastifyRequest, reply: FastifyReply): AuthUser | null {
  return requireAdmin(req, reply);
}

async function logActivity(
  db: Pool | PoolClient,
  opts: {
    boardId: string;
    cardId?: string | null;
    actorId?: string | null;
    type: string;
    payload?: Record<string, unknown>;
  },
) {
  await db.query(
    `insert into kanban_activity (board_id, card_id, actor_id, type, payload)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [
      opts.boardId,
      opts.cardId ?? null,
      opts.actorId ?? null,
      opts.type,
      JSON.stringify(opts.payload ?? {}),
    ],
  );
}

async function notify(
  db: Pool | PoolClient,
  opts: {
    userId: string;
    boardId?: string | null;
    cardId?: string | null;
    type: string;
    title: string;
    body?: string | null;
  },
) {
  await db.query(
    `insert into kanban_notifications (user_id, board_id, card_id, type, title, body)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      opts.userId,
      opts.boardId ?? null,
      opts.cardId ?? null,
      opts.type,
      opts.title,
      opts.body ?? null,
    ],
  );
}

async function reindexColumn(db: Pool | PoolClient, columnId: string) {
  await db.query(
    `
    with ordered as (
      select id, row_number() over (order by position asc, updated_at asc) - 1 as pos
      from kanban_cards
      where column_id = $1 and archived_at is null
    )
    update kanban_cards c set position = o.pos, updated_at = now()
    from ordered o where c.id = o.id
    `,
    [columnId],
  );
}

async function mapCard(pool: Pool, cardId: string) {
  const { rows } = await pool.query(
    `
    select c.*,
      coalesce(
        (select json_agg(json_build_object(
          'id', u.id, 'email', u.email, 'displayName', u.display_name
        ) order by u.email)
         from kanban_card_assignees a
         join users u on u.id = a.user_id
         where a.card_id = c.id), '[]'::json
      ) as assignees,
      coalesce(
        (select json_agg(json_build_object(
          'id', l.id, 'name', l.name, 'color', l.color
        ) order by l.name)
         from kanban_card_labels cl
         join kanban_labels l on l.id = cl.label_id
         where cl.card_id = c.id), '[]'::json
      ) as labels,
      (
        select count(*)::int from kanban_checklist_items i
        join kanban_checklists ch on ch.id = i.checklist_id
        where ch.card_id = c.id
      ) as checklist_total,
      (
        select count(*)::int from kanban_checklist_items i
        join kanban_checklists ch on ch.id = i.checklist_id
        where ch.card_id = c.id and i.done = true
      ) as checklist_done
    from kanban_cards c
    where c.id = $1
    `,
    [cardId],
  );
  const c = rows[0];
  if (!c) return null;
  return serializeCard(c);
}

function serializeCard(c: Record<string, unknown>) {
  return {
    id: c.id,
    boardId: c.board_id,
    columnId: c.column_id,
    title: c.title,
    description: c.description,
    position: Number(c.position),
    priority: c.priority,
    dueAt: c.due_at,
    startAt: c.start_at,
    sprintId: c.sprint_id,
    coverColor: c.cover_color,
    createdBy: c.created_by,
    archivedAt: c.archived_at,
    completedAt: c.completed_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    assignees: c.assignees || [],
    labels: c.labels || [],
    checklistTotal: Number(c.checklist_total || 0),
    checklistDone: Number(c.checklist_done || 0),
  };
}

export async function registerKanban(app: FastifyInstance, pool: Pool) {
  /** Staff users for assignee picker (any staff; only kanban roles can call) */
  app.get("/v1/admin/kanban/staff", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { rows } = await pool.query(
      `
      select u.id, u.email, u.display_name, r.code as role
      from users u
      join roles r on r.id = u.role_id
      where u.is_active = true and r.is_staff = true
      order by u.email
      `,
    );
    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
      })),
    };
  });

  app.get("/v1/admin/kanban/notifications", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const unreadOnly = String((req.query as { unread?: string }).unread || "") === "1";
    const { rows } = await pool.query(
      `
      select * from kanban_notifications
      where user_id = $1
        ${unreadOnly ? "and read_at is null" : ""}
      order by created_at desc
      limit 50
      `,
      [user.id],
    );
    return {
      items: rows.map((n) => ({
        id: n.id,
        boardId: n.board_id,
        cardId: n.card_id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
    };
  });

  app.post("/v1/admin/kanban/notifications/read", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const body = z
      .object({ ids: z.array(z.string().uuid()).optional() })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (body.data.ids?.length) {
      await pool.query(
        `update kanban_notifications set read_at = now()
         where user_id = $1 and id = any($2::uuid[])`,
        [user.id, body.data.ids],
      );
    } else {
      await pool.query(
        `update kanban_notifications set read_at = now()
         where user_id = $1 and read_at is null`,
        [user.id],
      );
    }
    return { ok: true };
  });

  app.get("/v1/admin/kanban/my-cards", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      `
      select c.*, b.title as board_title, col.title as column_title,
        coalesce(
          (select json_agg(json_build_object(
            'id', u.id, 'email', u.email, 'displayName', u.display_name
          )) from kanban_card_assignees a join users u on u.id = a.user_id where a.card_id = c.id),
          '[]'::json
        ) as assignees,
        coalesce(
          (select json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color))
           from kanban_card_labels cl join kanban_labels l on l.id = cl.label_id where cl.card_id = c.id),
          '[]'::json
        ) as labels,
        0 as checklist_total, 0 as checklist_done
      from kanban_card_assignees a
      join kanban_cards c on c.id = a.card_id
      join kanban_boards b on b.id = c.board_id
      join kanban_columns col on col.id = c.column_id
      where a.user_id = $1 and c.archived_at is null and b.archived_at is null
      order by c.due_at nulls last, c.updated_at desc
      limit 100
      `,
      [user.id],
    );
    return {
      items: rows.map((r) => ({
        ...serializeCard(r),
        boardTitle: r.board_title,
        columnTitle: r.column_title,
      })),
    };
  });

  // —— Boards ——
  app.get("/v1/admin/kanban/boards", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const archived = String((req.query as { archived?: string }).archived || "") === "1";
    const { rows } = await pool.query(
      `
      select b.*,
        (select count(*)::int from kanban_cards c where c.board_id = b.id and c.archived_at is null) as cards_count,
        (select count(*)::int from kanban_columns col where col.board_id = b.id and col.archived_at is null) as columns_count
      from kanban_boards b
      where ${archived ? "b.archived_at is not null" : "b.archived_at is null"}
      order by b.updated_at desc
      `,
    );
    return {
      items: rows.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        color: b.color,
        ownerId: b.owner_id,
        archivedAt: b.archived_at,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
        cardsCount: Number(b.cards_count || 0),
        columnsCount: Number(b.columns_count || 0),
      })),
    };
  });

  app.post("/v1/admin/kanban/boards", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const body = z
      .object({
        title: z.string().trim().min(1).max(160),
        description: z.string().max(2000).optional().nullable(),
        color: z.string().max(32).optional(),
        withDefaults: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(
        `insert into kanban_boards (title, description, color, owner_id)
         values ($1, $2, $3, $4)
         returning *`,
        [
          body.data.title,
          body.data.description ?? null,
          body.data.color || "#0f6e56",
          user.id,
        ],
      );
      const board = rows[0]!;
      if (body.data.withDefaults !== false) {
        const cols = ["Backlog", "Doing", "Review", "Done"];
        for (let i = 0; i < cols.length; i++) {
          await client.query(
            `insert into kanban_columns (board_id, title, position) values ($1, $2, $3)`,
            [board.id, cols[i], i],
          );
        }
      }
      await logActivity(client, {
        boardId: board.id,
        actorId: user.id,
        type: "board_created",
        payload: { title: board.title },
      });
      await client.query("commit");
      return reply.code(201).send({
        item: {
          id: board.id,
          title: board.title,
          description: board.description,
          color: board.color,
          ownerId: board.owner_id,
          archivedAt: board.archived_at,
          createdAt: board.created_at,
          updatedAt: board.updated_at,
          cardsCount: 0,
          columnsCount: body.data.withDefaults === false ? 0 : 4,
        },
      });
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  });

  app.patch("/v1/admin/kanban/boards/:id", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(160).optional(),
        description: z.string().max(2000).nullable().optional(),
        color: z.string().max(32).optional(),
        archived: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.title !== undefined) {
      values.push(body.data.title);
      fields.push(`title = $${values.length}`);
    }
    if (body.data.description !== undefined) {
      values.push(body.data.description);
      fields.push(`description = $${values.length}`);
    }
    if (body.data.color !== undefined) {
      values.push(body.data.color);
      fields.push(`color = $${values.length}`);
    }
    if (body.data.archived !== undefined) {
      values.push(body.data.archived ? new Date().toISOString() : null);
      fields.push(`archived_at = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    fields.push("updated_at = now()");
    values.push(id);
    const { rows } = await pool.query(
      `update kanban_boards set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await logActivity(pool, {
      boardId: id,
      actorId: user.id,
      type: body.data.archived ? "board_archived" : "board_updated",
    });
    return { item: rows[0] };
  });

  app.delete("/v1/admin/kanban/boards/:id", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from kanban_boards where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.get("/v1/admin/kanban/boards/:id/full", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rows: boards } = await pool.query(`select * from kanban_boards where id = $1`, [id]);
    const board = boards[0];
    if (!board) return reply.code(404).send({ error: "not_found" });

    const { rows: columns } = await pool.query(
      `select * from kanban_columns where board_id = $1 and archived_at is null order by position asc`,
      [id],
    );
    const { rows: cards } = await pool.query(
      `
      select c.*,
        coalesce(
          (select json_agg(json_build_object(
            'id', u.id, 'email', u.email, 'displayName', u.display_name
          ) order by u.email)
           from kanban_card_assignees a join users u on u.id = a.user_id where a.card_id = c.id),
          '[]'::json
        ) as assignees,
        coalesce(
          (select json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color) order by l.name)
           from kanban_card_labels cl join kanban_labels l on l.id = cl.label_id where cl.card_id = c.id),
          '[]'::json
        ) as labels,
        (select count(*)::int from kanban_checklist_items i
          join kanban_checklists ch on ch.id = i.checklist_id where ch.card_id = c.id) as checklist_total,
        (select count(*)::int from kanban_checklist_items i
          join kanban_checklists ch on ch.id = i.checklist_id where ch.card_id = c.id and i.done) as checklist_done
      from kanban_cards c
      where c.board_id = $1 and c.archived_at is null
      order by c.position asc
      `,
      [id],
    );
    const { rows: labels } = await pool.query(
      `select * from kanban_labels where board_id = $1 order by name`,
      [id],
    );
    const { rows: sprints } = await pool.query(
      `select * from kanban_sprints where board_id = $1 order by starts_on nulls last, created_at desc`,
      [id],
    );
    const { rows: activity } = await pool.query(
      `
      select a.*, u.display_name as actor_name, u.email as actor_email
      from kanban_activity a
      left join users u on u.id = a.actor_id
      where a.board_id = $1
      order by a.created_at desc
      limit 40
      `,
      [id],
    );

    const byCol = new Map<string, ReturnType<typeof serializeCard>[]>();
    for (const col of columns) byCol.set(col.id, []);
    for (const c of cards) {
      const list = byCol.get(c.column_id as string) || [];
      list.push(serializeCard(c));
      byCol.set(c.column_id as string, list);
    }

    return {
      board: {
        id: board.id,
        title: board.title,
        description: board.description,
        color: board.color,
        ownerId: board.owner_id,
        archivedAt: board.archived_at,
        createdAt: board.created_at,
        updatedAt: board.updated_at,
      },
      columns: columns.map((col) => ({
        id: col.id,
        title: col.title,
        position: Number(col.position),
        wipLimit: col.wip_limit,
        cards: byCol.get(col.id) || [],
      })),
      labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      sprints: sprints.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        startsOn: s.starts_on,
        endsOn: s.ends_on,
        status: s.status,
      })),
      activity: activity.map((a) => ({
        id: a.id,
        cardId: a.card_id,
        type: a.type,
        payload: a.payload,
        actorName: a.actor_name || a.actor_email,
        createdAt: a.created_at,
      })),
    };
  });

  // —— Columns ——
  app.post("/v1/admin/kanban/boards/:boardId/columns", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { boardId } = req.params as { boardId: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(120),
        wipLimit: z.number().int().positive().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows: maxPos } = await pool.query<{ m: number }>(
      `select coalesce(max(position), -1)::int as m from kanban_columns where board_id = $1 and archived_at is null`,
      [boardId],
    );
    const { rows } = await pool.query(
      `insert into kanban_columns (board_id, title, position, wip_limit)
       values ($1, $2, $3, $4) returning *`,
      [boardId, body.data.title, (maxPos[0]?.m ?? -1) + 1, body.data.wipLimit ?? null],
    );
    await logActivity(pool, {
      boardId,
      actorId: user.id,
      type: "column_created",
      payload: { title: body.data.title },
    });
    return reply.code(201).send({
      item: {
        id: rows[0].id,
        title: rows[0].title,
        position: Number(rows[0].position),
        wipLimit: rows[0].wip_limit,
        cards: [],
      },
    });
  });

  app.patch("/v1/admin/kanban/columns/:id", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(120).optional(),
        wipLimit: z.number().int().positive().nullable().optional(),
        archived: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.title !== undefined) {
      values.push(body.data.title);
      fields.push(`title = $${values.length}`);
    }
    if (body.data.wipLimit !== undefined) {
      values.push(body.data.wipLimit);
      fields.push(`wip_limit = $${values.length}`);
    }
    if (body.data.archived !== undefined) {
      values.push(body.data.archived ? new Date().toISOString() : null);
      fields.push(`archived_at = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    fields.push("updated_at = now()");
    values.push(id);
    const { rows } = await pool.query(
      `update kanban_columns set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await logActivity(pool, {
      boardId: rows[0].board_id,
      actorId: user.id,
      type: "column_updated",
    });
    return { item: rows[0] };
  });

  app.post("/v1/admin/kanban/boards/:boardId/columns/reorder", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { boardId } = req.params as { boardId: string };
    const body = z.object({ columnIds: z.array(z.string().uuid()).min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (let i = 0; i < body.data.columnIds.length; i++) {
        await client.query(
          `update kanban_columns set position = $1, updated_at = now()
           where id = $2 and board_id = $3`,
          [i, body.data.columnIds[i], boardId],
        );
      }
      await logActivity(client, {
        boardId,
        actorId: user.id,
        type: "columns_reordered",
      });
      await client.query("commit");
      return { ok: true };
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  });

  // —— Cards ——
  app.post("/v1/admin/kanban/columns/:columnId/cards", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { columnId } = req.params as { columnId: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(240),
        description: z.string().max(20000).optional().nullable(),
        priority: z.enum(["none", "low", "med", "high", "urgent"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: cols } = await pool.query(
      `select id, board_id from kanban_columns where id = $1`,
      [columnId],
    );
    const col = cols[0];
    if (!col) return reply.code(404).send({ error: "column_not_found" });

    const { rows: maxPos } = await pool.query<{ m: number }>(
      `select coalesce(max(position), -1)::int as m from kanban_cards where column_id = $1 and archived_at is null`,
      [columnId],
    );
    const { rows } = await pool.query(
      `insert into kanban_cards (board_id, column_id, title, description, position, priority, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        col.board_id,
        columnId,
        body.data.title,
        body.data.description ?? null,
        (maxPos[0]?.m ?? -1) + 1,
        body.data.priority || "none",
        user.id,
      ],
    );
    await logActivity(pool, {
      boardId: col.board_id,
      cardId: rows[0].id,
      actorId: user.id,
      type: "card_created",
      payload: { title: body.data.title },
    });
    const item = await mapCard(pool, rows[0].id);
    return reply.code(201).send({ item });
  });

  app.get("/v1/admin/kanban/cards/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const item = await mapCard(pool, id);
    if (!item || item.archivedAt) return reply.code(404).send({ error: "not_found" });

    const { rows: checklists } = await pool.query(
      `select * from kanban_checklists where card_id = $1 order by position`,
      [id],
    );
    const { rows: items } = await pool.query(
      `
      select i.* from kanban_checklist_items i
      join kanban_checklists c on c.id = i.checklist_id
      where c.card_id = $1
      order by i.position
      `,
      [id],
    );
    const { rows: comments } = await pool.query(
      `
      select cm.*, u.display_name as author_name, u.email as author_email
      from kanban_comments cm
      left join users u on u.id = cm.author_id
      where cm.card_id = $1
      order by cm.created_at asc
      `,
      [id],
    );
    const { rows: attachments } = await pool.query(
      `select * from kanban_attachments where card_id = $1 order by created_at desc`,
      [id],
    );
    const { rows: activity } = await pool.query(
      `
      select a.*, u.display_name as actor_name, u.email as actor_email
      from kanban_activity a
      left join users u on u.id = a.actor_id
      where a.card_id = $1
      order by a.created_at desc
      limit 30
      `,
      [id],
    );

    const byCl = new Map<string, typeof items>();
    for (const it of items) {
      const list = byCl.get(it.checklist_id) || [];
      list.push(it);
      byCl.set(it.checklist_id, list);
    }

    return {
      item,
      checklists: checklists.map((ch) => ({
        id: ch.id,
        title: ch.title,
        position: Number(ch.position),
        items: (byCl.get(ch.id) || []).map((it) => ({
          id: it.id,
          title: it.title,
          done: it.done,
          position: Number(it.position),
          assigneeId: it.assignee_id,
        })),
      })),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorId: c.author_id,
        authorName: c.author_name || c.author_email,
        createdAt: c.created_at,
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        url: a.url,
        name: a.name,
        createdAt: a.created_at,
      })),
      activity: activity.map((a) => ({
        id: a.id,
        type: a.type,
        payload: a.payload,
        actorName: a.actor_name || a.actor_email,
        createdAt: a.created_at,
      })),
    };
  });

  app.patch("/v1/admin/kanban/cards/:id", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(240).optional(),
        description: z.string().max(20000).nullable().optional(),
        priority: z.enum(["none", "low", "med", "high", "urgent"]).optional(),
        dueAt: z.string().datetime().nullable().optional(),
        startAt: z.string().datetime().nullable().optional(),
        sprintId: z.string().uuid().nullable().optional(),
        coverColor: z.string().max(32).nullable().optional(),
        completed: z.boolean().optional(),
        archived: z.boolean().optional(),
        assigneeIds: z.array(z.string().uuid()).optional(),
        labelIds: z.array(z.string().uuid()).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: existing } = await pool.query(`select * from kanban_cards where id = $1`, [id]);
    const card = existing[0];
    if (!card) return reply.code(404).send({ error: "not_found" });

    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (col: string, val: unknown) => {
      values.push(val);
      fields.push(`${col} = $${values.length}`);
    };
    if (body.data.title !== undefined) set("title", body.data.title);
    if (body.data.description !== undefined) set("description", body.data.description);
    if (body.data.priority !== undefined) set("priority", body.data.priority);
    if (body.data.dueAt !== undefined) set("due_at", body.data.dueAt);
    if (body.data.startAt !== undefined) set("start_at", body.data.startAt);
    if (body.data.sprintId !== undefined) set("sprint_id", body.data.sprintId);
    if (body.data.coverColor !== undefined) set("cover_color", body.data.coverColor);
    if (body.data.completed !== undefined) {
      set("completed_at", body.data.completed ? new Date().toISOString() : null);
    }
    if (body.data.archived !== undefined) {
      set("archived_at", body.data.archived ? new Date().toISOString() : null);
    }
    if (fields.length) {
      fields.push("updated_at = now()");
      values.push(id);
      await pool.query(
        `update kanban_cards set ${fields.join(", ")} where id = $${values.length}`,
        values,
      );
    }

    if (body.data.assigneeIds) {
      const prev = await pool.query<{ user_id: string }>(
        `select user_id from kanban_card_assignees where card_id = $1`,
        [id],
      );
      const prevSet = new Set(prev.rows.map((r) => r.user_id));
      await pool.query(`delete from kanban_card_assignees where card_id = $1`, [id]);
      for (const uid of body.data.assigneeIds) {
        await pool.query(
          `insert into kanban_card_assignees (card_id, user_id) values ($1, $2) on conflict do nothing`,
          [id, uid],
        );
        if (!prevSet.has(uid) && uid !== user.id) {
          await notify(pool, {
            userId: uid,
            boardId: card.board_id,
            cardId: id,
            type: "assigned",
            title: `Вас назначили: ${card.title}`,
            body: user.displayName || user.email,
          });
        }
      }
    }

    if (body.data.labelIds) {
      await pool.query(`delete from kanban_card_labels where card_id = $1`, [id]);
      for (const lid of body.data.labelIds) {
        await pool.query(
          `insert into kanban_card_labels (card_id, label_id) values ($1, $2) on conflict do nothing`,
          [id, lid],
        );
      }
    }

    await logActivity(pool, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      type: "card_updated",
    });
    return { item: await mapCard(pool, id) };
  });

  app.post("/v1/admin/kanban/cards/:id/move", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        columnId: z.string().uuid(),
        position: z.number().int().min(0),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const { rows: cards } = await pool.query(`select * from kanban_cards where id = $1`, [id]);
    const card = cards[0];
    if (!card) return reply.code(404).send({ error: "not_found" });

    const { rows: cols } = await pool.query(
      `select * from kanban_columns where id = $1 and board_id = $2`,
      [body.data.columnId, card.board_id],
    );
    if (!cols[0]) return reply.code(400).send({ error: "bad_column" });

    const client = await pool.connect();
    try {
      await client.query("begin");
      const fromCol = card.column_id;
      await client.query(
        `update kanban_cards set column_id = $1, position = $2, updated_at = now() where id = $3`,
        [body.data.columnId, body.data.position, id],
      );
      // shift others in target
      await client.query(
        `
        update kanban_cards set position = position + 1, updated_at = now()
        where column_id = $1 and id <> $2 and position >= $3 and archived_at is null
        `,
        [body.data.columnId, id, body.data.position],
      );
      await reindexColumn(client, body.data.columnId);
      if (fromCol !== body.data.columnId) await reindexColumn(client, fromCol);
      await logActivity(client, {
        boardId: card.board_id,
        cardId: id,
        actorId: user.id,
        type: "card_moved",
        payload: { columnId: body.data.columnId, position: body.data.position },
      });
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    return { item: await mapCard(pool, id) };
  });

  app.delete("/v1/admin/kanban/cards/:id", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `delete from kanban_cards where id = $1 returning board_id`,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    await logActivity(pool, {
      boardId: rows[0].board_id,
      actorId: user.id,
      type: "card_deleted",
      payload: { cardId: id },
    });
    return { ok: true };
  });

  // —— Checklists ——
  app.post("/v1/admin/kanban/cards/:cardId/checklists", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { cardId } = req.params as { cardId: string };
    const body = z.object({ title: z.string().trim().min(1).max(160).optional() }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows: cards } = await pool.query(`select board_id from kanban_cards where id = $1`, [cardId]);
    if (!cards[0]) return reply.code(404).send({ error: "not_found" });
    const { rows: maxPos } = await pool.query<{ m: number }>(
      `select coalesce(max(position), -1)::int as m from kanban_checklists where card_id = $1`,
      [cardId],
    );
    const { rows } = await pool.query(
      `insert into kanban_checklists (card_id, title, position) values ($1, $2, $3) returning *`,
      [cardId, body.data.title || "Checklist", (maxPos[0]?.m ?? -1) + 1],
    );
    return reply.code(201).send({
      item: { id: rows[0].id, title: rows[0].title, position: Number(rows[0].position), items: [] },
    });
  });

  app.patch("/v1/admin/kanban/checklists/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z.object({ title: z.string().trim().min(1).max(160) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows } = await pool.query(
      `update kanban_checklists set title = $1 where id = $2 returning *`,
      [body.data.title, id],
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: rows[0] };
  });

  app.delete("/v1/admin/kanban/checklists/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from kanban_checklists where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.post("/v1/admin/kanban/checklists/:id/items", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(240),
        assigneeId: z.string().uuid().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows: maxPos } = await pool.query<{ m: number }>(
      `select coalesce(max(position), -1)::int as m from kanban_checklist_items where checklist_id = $1`,
      [id],
    );
    const { rows } = await pool.query(
      `insert into kanban_checklist_items (checklist_id, title, position, assignee_id)
       values ($1, $2, $3, $4) returning *`,
      [id, body.data.title, (maxPos[0]?.m ?? -1) + 1, body.data.assigneeId ?? null],
    );
    return reply.code(201).send({
      item: {
        id: rows[0].id,
        title: rows[0].title,
        done: rows[0].done,
        position: Number(rows[0].position),
        assigneeId: rows[0].assignee_id,
      },
    });
  });

  app.patch("/v1/admin/kanban/checklist-items/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        title: z.string().trim().min(1).max(240).optional(),
        done: z.boolean().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.title !== undefined) {
      values.push(body.data.title);
      fields.push(`title = $${values.length}`);
    }
    if (body.data.done !== undefined) {
      values.push(body.data.done);
      fields.push(`done = $${values.length}`);
    }
    if (body.data.assigneeId !== undefined) {
      values.push(body.data.assigneeId);
      fields.push(`assignee_id = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    const { rows } = await pool.query(
      `update kanban_checklist_items set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return {
      item: {
        id: rows[0].id,
        title: rows[0].title,
        done: rows[0].done,
        position: Number(rows[0].position),
        assigneeId: rows[0].assignee_id,
      },
    };
  });

  app.delete("/v1/admin/kanban/checklist-items/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from kanban_checklist_items where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  // —— Labels ——
  app.post("/v1/admin/kanban/boards/:boardId/labels", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { boardId } = req.params as { boardId: string };
    const body = z
      .object({
        name: z.string().trim().min(1).max(60),
        color: z.string().max(32).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows } = await pool.query(
      `insert into kanban_labels (board_id, name, color) values ($1, $2, $3) returning *`,
      [boardId, body.data.name, body.data.color || "#6b4ea8"],
    );
    return reply.code(201).send({
      item: { id: rows[0].id, name: rows[0].name, color: rows[0].color },
    });
  });

  app.patch("/v1/admin/kanban/labels/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().trim().min(1).max(60).optional(),
        color: z.string().max(32).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.data.name !== undefined) {
      values.push(body.data.name);
      fields.push(`name = $${values.length}`);
    }
    if (body.data.color !== undefined) {
      values.push(body.data.color);
      fields.push(`color = $${values.length}`);
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    values.push(id);
    const { rows } = await pool.query(
      `update kanban_labels set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return { item: { id: rows[0].id, name: rows[0].name, color: rows[0].color } };
  });

  app.delete("/v1/admin/kanban/labels/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from kanban_labels where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  // —— Sprints ——
  app.post("/v1/admin/kanban/boards/:boardId/sprints", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { boardId } = req.params as { boardId: string };
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        goal: z.string().max(1000).nullable().optional(),
        startsOn: z.string().optional().nullable(),
        endsOn: z.string().optional().nullable(),
        status: z.enum(["planned", "active", "closed"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows } = await pool.query(
      `insert into kanban_sprints (board_id, name, goal, starts_on, ends_on, status)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [
        boardId,
        body.data.name,
        body.data.goal ?? null,
        body.data.startsOn || null,
        body.data.endsOn || null,
        body.data.status || "planned",
      ],
    );
    return reply.code(201).send({
      item: {
        id: rows[0].id,
        name: rows[0].name,
        goal: rows[0].goal,
        startsOn: rows[0].starts_on,
        endsOn: rows[0].ends_on,
        status: rows[0].status,
      },
    });
  });

  app.patch("/v1/admin/kanban/sprints/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        goal: z.string().max(1000).nullable().optional(),
        startsOn: z.string().nullable().optional(),
        endsOn: z.string().nullable().optional(),
        status: z.enum(["planned", "active", "closed"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const fields: string[] = [];
    const values: unknown[] = [];
    const map: Record<string, string> = {
      name: "name",
      goal: "goal",
      startsOn: "starts_on",
      endsOn: "ends_on",
      status: "status",
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body.data as Record<string, unknown>)[k] !== undefined) {
        values.push((body.data as Record<string, unknown>)[k]);
        fields.push(`${col} = $${values.length}`);
      }
    }
    if (!fields.length) return reply.code(400).send({ error: "empty_patch" });
    fields.push("updated_at = now()");
    values.push(id);
    const { rows } = await pool.query(
      `update kanban_sprints set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    return {
      item: {
        id: rows[0].id,
        name: rows[0].name,
        goal: rows[0].goal,
        startsOn: rows[0].starts_on,
        endsOn: rows[0].ends_on,
        status: rows[0].status,
      },
    };
  });

  app.delete("/v1/admin/kanban/sprints/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from kanban_sprints where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  // —— Comments ——
  app.post("/v1/admin/kanban/cards/:cardId/comments", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { cardId } = req.params as { cardId: string };
    const body = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows: cards } = await pool.query(`select board_id, title from kanban_cards where id = $1`, [
      cardId,
    ]);
    if (!cards[0]) return reply.code(404).send({ error: "not_found" });
    const { rows } = await pool.query(
      `insert into kanban_comments (card_id, author_id, body) values ($1, $2, $3) returning *`,
      [cardId, user.id, body.data.body],
    );
    await logActivity(pool, {
      boardId: cards[0].board_id,
      cardId,
      actorId: user.id,
      type: "comment_added",
    });
    // notify other assignees
    const { rows: assignees } = await pool.query(
      `select user_id from kanban_card_assignees where card_id = $1 and user_id <> $2`,
      [cardId, user.id],
    );
    for (const a of assignees) {
      await notify(pool, {
        userId: a.user_id,
        boardId: cards[0].board_id,
        cardId,
        type: "comment",
        title: `Комментарий: ${cards[0].title}`,
        body: body.data.body.slice(0, 160),
      });
    }
    return reply.code(201).send({
      item: {
        id: rows[0].id,
        body: rows[0].body,
        authorId: rows[0].author_id,
        authorName: user.displayName || user.email,
        createdAt: rows[0].created_at,
      },
    });
  });

  app.delete("/v1/admin/kanban/comments/:id", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(`select * from kanban_comments where id = $1`, [id]);
    if (!rows[0]) return reply.code(404).send({ error: "not_found" });
    if (rows[0].author_id !== user.id && user.role !== "admin" && user.role !== "developer") {
      return reply.code(403).send({ error: "forbidden" });
    }
    await pool.query(`delete from kanban_comments where id = $1`, [id]);
    return { ok: true };
  });

  // —— Attachments (URL) ——
  app.post("/v1/admin/kanban/cards/:cardId/attachments", async (req, reply) => {
    const user = requireKanban(req, reply);
    if (!user) return;
    const { cardId } = req.params as { cardId: string };
    const body = z
      .object({
        url: z.string().url().max(2000),
        name: z.string().max(240).optional().nullable(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { rows: cards } = await pool.query(`select board_id from kanban_cards where id = $1`, [cardId]);
    if (!cards[0]) return reply.code(404).send({ error: "not_found" });
    const { rows } = await pool.query(
      `insert into kanban_attachments (card_id, url, name, created_by) values ($1, $2, $3, $4) returning *`,
      [cardId, body.data.url, body.data.name || null, user.id],
    );
    return reply.code(201).send({
      item: {
        id: rows[0].id,
        url: rows[0].url,
        name: rows[0].name,
        createdAt: rows[0].created_at,
      },
    });
  });

  app.delete("/v1/admin/kanban/attachments/:id", async (req, reply) => {
    if (!requireKanban(req, reply)) return;
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(`delete from kanban_attachments where id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });
}

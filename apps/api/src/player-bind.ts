import type { Pool } from "pg";

export async function ensurePlayerAccountSchema(pool: Pool) {
  await pool.query(`alter table players add column if not exists user_id uuid references users(id) on delete set null`).catch(() => undefined);
  await pool.query(`create unique index if not exists players_user_id_uidx on players (user_id) where user_id is not null`).catch(() => undefined);
  await pool.query(`alter table complaints add column if not exists author_user_id uuid references users(id) on delete set null`).catch(() => undefined);
  await pool.query(`create index if not exists complaints_author_user_idx on complaints (author_user_id)`).catch(() => undefined);
}

async function attachHistory(pool: Pool, userId: string, playerId: string) {
  await pool.query(
    `update reviews set author_user_id = $1
     where player_id = $2 and author_user_id is null`,
    [userId, playerId],
  );
  await pool.query(
    `update complaints set author_user_id = $1
     where author_user_id is null
       and lower(author_email) = (select lower(email) from users where id = $1)`,
    [userId],
  );
}

/** One player row per registered user. Guest cookie player is claimed if free. */
export async function bindPlayerToUser(
  pool: Pool,
  userId: string,
  guestPlayerId?: string | null,
): Promise<string> {
  await ensurePlayerAccountSchema(pool);

  const mine = await pool.query<{ id: string }>(
    `select id from players where user_id = $1 limit 1`,
    [userId],
  );
  if (mine.rows[0]) {
    await attachHistory(pool, userId, mine.rows[0].id);
    return mine.rows[0].id;
  }

  if (guestPlayerId) {
    const guest = await pool.query<{ id: string; user_id: string | null }>(
      `select id, user_id from players where id = $1 limit 1`,
      [guestPlayerId],
    );
    const g = guest.rows[0];
    if (g && !g.user_id) {
      await pool.query(`update players set user_id = $2 where id = $1 and user_id is null`, [
        g.id,
        userId,
      ]);
      await attachHistory(pool, userId, g.id);
      return g.id;
    }
  }

  const created = await pool.query<{ id: string }>(
    `insert into players (cookie_id, user_id)
     values ($1, $2)
     returning id`,
    [`user:${userId}`, userId],
  );
  const id = created.rows[0]?.id;
  if (!id) throw new Error("player_bind_failed");
  await attachHistory(pool, userId, id);
  return id;
}

export async function playerIdForUser(pool: Pool, userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `select id from players where user_id = $1 limit 1`,
    [userId],
  );
  return rows[0]?.id ?? null;
}

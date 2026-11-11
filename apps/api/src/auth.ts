import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";

export const SESSION_COOKIE = "xr_session";
const SESSION_DAYS = 7;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isStaff: boolean;
  casinoId: string | null;
};

/** @deprecated use AuthUser */
export type StaffUser = AuthUser;

export type AuthDestination = "admin" | "partner" | "account";

declare module "fastify" {
  interface FastifyRequest {
    staffUser: AuthUser | null;
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function cookieOpts() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function destinationForUser(user: AuthUser): AuthDestination {
  if (user.isStaff)
    return "admin";
  if (user.role === "partner_rep")
    return "partner";
  return "account";
}

async function loadUserBySession(
  pool: Pool,
  token: string | undefined,
): Promise<AuthUser | null> {
  if (!token)
    return null;
  const tokenHash = hashToken(token);
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    is_staff: boolean;
    casino_id: string | null;
    session_id: string;
  }>(
    `
    select
      u.id, u.email, u.display_name, u.casino_id,
      r.code as role, r.is_staff,
      s.id as session_id
    from staff_sessions s
    join users u on u.id = s.user_id
    join roles r on r.id = u.role_id
    where s.token_hash = $1
      and s.expires_at > now()
      and u.is_active = true
    limit 1
    `,
    [tokenHash],
  );
  const row = rows[0];
  if (!row)
    return null;

  await pool.query(
    `update staff_sessions set last_seen_at = now() where id = $1`,
    [row.session_id],
  );

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isStaff: row.is_staff,
    casinoId: row.casino_id,
  };
}

async function createSession(
  pool: Pool,
  userId: string,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `
    insert into staff_sessions (user_id, token_hash, expires_at, user_agent, ip)
    values ($1, $2, $3, $4, $5::inet)
    `,
    [
      userId,
      tokenHash,
      expiresAt.toISOString(),
      String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
      req.ip || null,
    ],
  );

  reply.setCookie(SESSION_COOKIE, token, cookieOpts());
}

export async function registerAuth(app: FastifyInstance, pool: Pool) {
  await app.register(cookie);

  app.decorateRequest("staffUser", null);

  app.addHook("preHandler", async (req) => {
    const token = req.cookies?.[SESSION_COOKIE];
    req.staffUser = await loadUserBySession(pool, token);
  });

  app.post("/v1/auth/register", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email().max(320),
        password: z.string().min(6).max(200),
        displayName: z.string().trim().min(2).max(80),
      })
      .safeParse(req.body);

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }

    const email = body.data.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(body.data.password, 10);

    const { rows: roleRows } = await pool.query<{ id: number }>(
      `select id from roles where code = 'player' limit 1`,
    );
    const roleId = roleRows[0]?.id;
    if (!roleId) {
      return reply.code(500).send({ error: "player_role_missing" });
    }

    try {
      const { rows } = await pool.query<{
        id: string;
        email: string;
        display_name: string | null;
        casino_id: string | null;
      }>(
        `
        insert into users (email, display_name, role_id, password_hash)
        values ($1, $2, $3, $4)
        returning id, email, display_name, casino_id
        `,
        [email, body.data.displayName, roleId, passwordHash],
      );
      const created = rows[0]!;
      const user: AuthUser = {
        id: created.id,
        email: created.email,
        displayName: created.display_name,
        role: "player",
        isStaff: false,
        casinoId: created.casino_id,
      };
      await createSession(pool, user.id, req, reply);
      return reply.code(201).send({
        user,
        destination: destinationForUser(user),
      });
    }
    catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        return reply.code(409).send({ error: "email_taken" });
      }
      throw err;
    }
  });

  app.post("/v1/auth/login", async (req, reply) => {
    const body = z
      .object({
        // Accept email or short login (e.g. edmccain → edmccain@casino-review.local)
        email: z.string().trim().min(1).max(320),
        password: z.string().min(1).max(200),
      })
      .safeParse(req.body);

    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }

    const rawLogin = body.data.email.trim().toLowerCase();
    const email = rawLogin.includes("@")
      ? rawLogin
      : `${rawLogin}@casino-review.local`;
    const { rows } = await pool.query<{
      id: string;
      email: string;
      display_name: string | null;
      password_hash: string | null;
      casino_id: string | null;
      role: string;
      is_staff: boolean;
      is_active: boolean;
    }>(
      `
      select
        u.id, u.email, u.display_name, u.password_hash, u.casino_id, u.is_active,
        r.code as role, r.is_staff
      from users u
      join roles r on r.id = u.role_id
      where lower(u.email) = $1
      limit 1
      `,
      [email],
    );


    const row = rows[0];
    if (!row?.password_hash || !row.is_active) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const ok = await bcrypt.compare(body.data.password, row.password_hash);
    if (!ok) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const user: AuthUser = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      isStaff: row.is_staff,
      casinoId: row.casino_id,
    };

    await createSession(pool, user.id, req, reply);

    return {
      user,
      destination: destinationForUser(user),
    };
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      await pool.query(`delete from staff_sessions where token_hash = $1`, [
        hashToken(token),
      ]);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/v1/auth/me", async (req) => {
    // Guests get 200 + null (avoids noisy 401s in PageSpeed / console).
    if (!req.staffUser) {
      return { user: null, destination: null };
    }
    return {
      user: req.staffUser,
      destination: destinationForUser(req.staffUser),
    };
  });
}

export function requireStaff(
  req: FastifyRequest,
  reply: FastifyReply,
): AuthUser | null {
  if (!req.staffUser?.isStaff) {
    void reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return req.staffUser;
}

/** Roles with full admin privileges (settings / rewards / etc.). */
export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "developer";
}

/** Lawyer + admin/developer can approve blacklist publications. */
export function isLawyerRole(role: string): boolean {
  return role === "lawyer" || isAdminRole(role);
}

export function requireLawyer(
  req: FastifyRequest,
  reply: FastifyReply,
): AuthUser | null {
  const user = requireStaff(req, reply);
  if (!user) return null;
  if (!isLawyerRole(user.role)) {
    void reply.code(403).send({ error: "forbidden_lawyer_only" });
    return null;
  }
  return user;
}


/** Main admin / developer only. */
export function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): AuthUser | null {
  const user = requireStaff(req, reply);
  if (!user) return null;
  if (!isAdminRole(user.role)) {
    void reply.code(403).send({ error: "forbidden_admin_only" });
    return null;
  }
  return user;
}


/** Partner rep with bound casino, or staff (for support). */
export function requirePartner(
  req: FastifyRequest,
  reply: FastifyReply,
): AuthUser | null {
  const user = req.staffUser;
  if (!user) {
    void reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  if (user.isStaff) return user;
  if (user.role === "partner_rep" && user.casinoId) return user;
  void reply.code(403).send({ error: "forbidden_partner" });
  return null;
}

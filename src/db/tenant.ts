/**
 * Tenant context helpers
 *
 * CRITICAL: after BEGIN we SET LOCAL ROLE app_user so FORCE RLS applies.
 * Owner connection alone bypasses RLS even with FORCE (Neon superuser).
 *
 * Long-term: dedicated app_login role + separate DATABASE_URL (no owner in app).
 */

import { createTenantPool } from "./client";
import type { PoolClient } from "@neondatabase/serverless";

export type SessionLike = {
  user: {
    id: string;
    orgId: string;
    role: string;
    tokenVersion: number;
  };
};

/**
 * Authenticated tenant path.
 * orgId MUST come from the validated session, never from request body/URL.
 */
export async function withTenant<T>(
  session: SessionLike,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!session?.user?.orgId) {
    throw new Error("withTenant requires a valid session with orgId");
  }
  return withOrgContext(session.user.orgId, session.user.id, callback);
}

/**
 * Trusted internal tenant path.
 * Sets transaction-local GUC + SET LOCAL ROLE app_user.
 */
export async function withOrgContext<T>(
  orgId: string,
  actorId: string | null,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!orgId || typeof orgId !== "string") {
    throw new Error("withOrgContext requires a trusted orgId");
  }

  const pool = createTenantPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Ensure we can assume app_user (owner must be a member)
    await client.query(`GRANT app_user TO CURRENT_USER`).catch(() => {
      /* already granted */
    });

    // FORCE RLS only applies once we are not the bypassing owner
    await client.query(`SET LOCAL ROLE app_user`);

    // Transaction-local tenant context
    await client.query(
      `SELECT set_config('app.current_org_id', $1, true)`,
      [orgId]
    );

    // Actor for audit integrity (read inside append_activity_log later)
    if (actorId) {
      await client.query(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [actorId]
      );
    }

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

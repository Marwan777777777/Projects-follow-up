/**
 * Tenant context helpers
 *
 * withTenant(session, cb)     — authenticated request path
 * withOrgContext(orgId, cb)   — trusted internal path (cron, pre-auth, bootstrap)
 *
 * Both set transaction-local GUC: app.current_org_id
 * FORCE RLS policies use current_setting('app.current_org_id', true)::uuid
 */

import { createTenantPool, createTenantDb, type TenantDb } from "./client";
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
  callback: (db: TenantDb, client: PoolClient) => Promise<T>
): Promise<T> {
  if (!session?.user?.orgId) {
    throw new Error("withTenant requires a valid session with orgId");
  }
  return withOrgContext(session.user.orgId, callback);
}

/**
 * Trusted internal tenant path.
 * Callers are limited to: cron, pre-auth modules, bootstrap, housekeeping.
 * orgId must originate from control-plane or other trusted server source.
 * Must NOT be reachable from ordinary feature code with client-supplied orgId.
 */
export async function withOrgContext<T>(
  orgId: string,
  callback: (db: TenantDb, client: PoolClient) => Promise<T>
): Promise<T> {
  if (!orgId || typeof orgId !== "string") {
    throw new Error("withOrgContext requires a trusted orgId");
  }

  const pool = createTenantPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // Transaction-local tenant context (true = local to transaction)
    await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgId]);

    const db = createTenantDb(pool);

    const result = await callback(db, client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

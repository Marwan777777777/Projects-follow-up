/**
 * Database clients
 * - WebSocket Pool for all tenant work (withTenant / withOrgContext)
 * - Prefer DATABASE_URL_APP (app_login role, NOBYPASSRLS)
 * - Fall back to DATABASE_URL only if APP url is not set (dev convenience)
 * - HTTP driver only for non-tenant / health checks / migrations (owner)
 */

import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Required for Neon serverless Pool in Node
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

/** Tenant / runtime connection – must be app_login (or equivalent NOBYPASSRLS). */
function tenantConnectionString(): string {
  const app = process.env.DATABASE_URL_APP;
  const owner = process.env.DATABASE_URL;
  const url = app || owner;
  if (!url) {
    throw new Error("DATABASE_URL_APP (preferred) or DATABASE_URL is required");
  }
  if (!app && process.env.NODE_ENV === "production") {
    console.warn(
      "[db] DATABASE_URL_APP is not set. Runtime is using DATABASE_URL (owner). Set app_login role URL for production."
    );
  }
  return url;
}

/** Owner connection – migrations / scripts only. */
function ownerConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (owner) is required for migrations");
  return url;
}

export function createTenantPool() {
  return new Pool({ connectionString: tenantConnectionString() });
}

export function createTenantDb(pool: Pool) {
  return drizzle(pool, { schema });
}

export function createHttpDb() {
  const sql = neon(tenantConnectionString());
  return drizzle(sql as any, { schema });
}

/** HTTP client bound to owner URL – scripts/migrations only. */
export function createOwnerHttpSql() {
  return neon(ownerConnectionString());
}

export type TenantDb = ReturnType<typeof createTenantDb>;

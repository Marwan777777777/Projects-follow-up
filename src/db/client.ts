/**
 * Database clients
 * - WebSocket Pool for all tenant work (withTenant / withOrgContext)
 * - HTTP driver only for non-tenant / health checks
 */

import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Required for Neon serverless in Node
neonConfig.webSocketConstructor = WebSocket;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Allow build-time without env; runtime will fail clearly
  console.warn("DATABASE_URL is not set");
}

/**
 * Pooled WebSocket client — use ONLY inside withTenant / withOrgContext
 * Never export the raw pool for ordinary application code.
 */
export function createTenantPool() {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return new Pool({ connectionString });
}

export function createTenantDb(pool: Pool) {
  return drizzle(pool, { schema });
}

/**
 * HTTP driver — non-tenant reads only (platform, health, org discovery)
 */
export function createHttpDb() {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const sql = neon(connectionString);
  return drizzle(sql as any, { schema });
}

export type TenantDb = ReturnType<typeof createTenantDb>;

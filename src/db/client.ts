/**
 * Database clients
 * - WebSocket Pool for all tenant work (withTenant / withOrgContext)
 * - HTTP driver only for non-tenant / health checks
 */

import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Required for Neon serverless Pool in Node
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("DATABASE_URL is not set");
}

export function createTenantPool() {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return new Pool({ connectionString });
}

export function createTenantDb(pool: Pool) {
  return drizzle(pool, { schema });
}

export function createHttpDb() {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const sql = neon(connectionString);
  return drizzle(sql as any, { schema });
}

export type TenantDb = ReturnType<typeof createTenantDb>;

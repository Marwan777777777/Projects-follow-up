/**
 * Cross-tenant isolation test (Slice 1)
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."
 *   npx tsx src/tests/isolation.test.ts
 */

import { neon, Pool } from "@neondatabase/serverless";

// Load .env.local if present (no top-level await)
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  // dotenv optional
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL required. On Windows PowerShell run:");
  console.error('  $env:DATABASE_URL="postgresql://..."');
  console.error("Then re-run this command.");
  process.exit(1);
}

async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("\u274c FAIL:", message);
    process.exit(1);
  }
  console.log("\u2705", message);
}

async function main() {
  const sql = neon(connectionString!);
  const pool = new Pool({ connectionString });

  console.log("\n=== Slice 1 Isolation Tests ===\n");

  let orgA = (await sql`SELECT id FROM organizations WHERE slug = 'test-org-a' LIMIT 1`)[0];
  let orgB = (await sql`SELECT id FROM organizations WHERE slug = 'test-org-b' LIMIT 1`)[0];

  if (!orgA) {
    [orgA] = await sql`
      INSERT INTO organizations (name, slug) VALUES ('Test Org A', 'test-org-a')
      RETURNING id
    `;
  }
  if (!orgB) {
    [orgB] = await sql`
      INSERT INTO organizations (name, slug) VALUES ('Test Org B', 'test-org-b')
      RETURNING id
    `;
  }

  const orgAId = orgA.id as string;
  const orgBId = orgB.id as string;

  await sql`SELECT set_config('app.current_org_id', ${orgAId}, true)`;
  const existingA = await sql`SELECT id FROM users WHERE org_id = ${orgAId} LIMIT 1`;
  if (existingA.length === 0) {
    await sql`
      INSERT INTO users (org_id, full_name, username, password_hash, role, status, must_change_password)
      VALUES (${orgAId}, 'User A', 'usera', 'hash', 'Admin', 'Active', false)
    `;
    await sql`
      INSERT INTO projects (org_id, project_name, client_name, project_status)
      VALUES (${orgAId}, 'Project A', 'Client A', 'In Progress')
    `;
  }

  await sql`SELECT set_config('app.current_org_id', ${orgBId}, true)`;
  const existingB = await sql`SELECT id FROM users WHERE org_id = ${orgBId} LIMIT 1`;
  if (existingB.length === 0) {
    await sql`
      INSERT INTO users (org_id, full_name, username, password_hash, role, status, must_change_password)
      VALUES (${orgBId}, 'User B', 'userb', 'hash', 'Admin', 'Active', false)
    `;
    await sql`
      INSERT INTO projects (org_id, project_name, client_name, project_status)
      VALUES (${orgBId}, 'Project B', 'Client B', 'In Progress')
    `;
  }

  // Test 1: no matching tenant context → zero rows
  {
    const client = await pool.connect();
    try {
      await client.query(`SELECT set_config('app.current_org_id', '00000000-0000-0000-0000-000000000000', true)`);
      const res = await client.query(`SELECT count(*)::int AS c FROM users`);
      await assert(res.rows[0].c === 0, "No matching tenant context \u2192 zero users visible");
    } finally {
      client.release();
    }
  }

  // Test 2: org A context sees only org A
  {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgAId]);
      const users = await client.query(`SELECT org_id FROM users`);
      const projects = await client.query(`SELECT org_id FROM projects`);
      await client.query("COMMIT");

      await assert(
        users.rows.every((r: any) => r.org_id === orgAId),
        "Org A context: all users belong to org A"
      );
      await assert(
        projects.rows.every((r: any) => r.org_id === orgAId),
        "Org A context: all projects belong to org A"
      );
      await assert(users.rows.length >= 1, "Org A context: at least one user visible");
    } finally {
      client.release();
    }
  }

  // Test 3: org B context cannot see org A
  {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgBId]);
      const users = await client.query(`SELECT org_id FROM users WHERE org_id = $1`, [orgAId]);
      const projects = await client.query(`SELECT org_id FROM projects WHERE org_id = $1`, [orgAId]);
      await client.query("COMMIT");

      await assert(users.rows.length === 0, "Org B context: cannot SELECT org A users");
      await assert(projects.rows.length === 0, "Org B context: cannot SELECT org A projects");
    } finally {
      client.release();
    }
  }

  // Test 4: INSERT into wrong tenant is blocked by WITH CHECK
  {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgAId]);
      let blocked = false;
      try {
        await client.query(
          `INSERT INTO projects (org_id, project_name, client_name) VALUES ($1, 'Evil', 'Evil')`,
          [orgBId]
        );
      } catch {
        blocked = true;
      }
      await client.query("ROLLBACK");
      await assert(blocked, "WITH CHECK blocks INSERT of org B row under org A context");
    } finally {
      client.release();
    }
  }

  console.log("\n=== All isolation tests passed ===\n");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

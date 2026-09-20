/**
 * User mutations — create Site Engineer
 */

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { PoolClient } from "@neondatabase/serverless";
import { withTenant, type SessionLike } from "@/db/tenant";
import { assertPermission } from "@/lib/permissions";

async function audit(
  client: PoolClient,
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  newValues?: Record<string, unknown>
) {
  await client.query(
    `SELECT append_activity_log($1::uuid, $2, $3::uuid, $4, NULL, $5::jsonb, NULL)`,
    [actorId, entityType, entityId, action, JSON.stringify(newValues ?? null)]
  );
}

export async function createEngineer(
  session: SessionLike,
  input: { fullName: string; username: string; email?: string }
) {
  assertPermission(session.user.role, "users.manage");

  const fullName = input.fullName.trim();
  const username = input.username.trim().toLowerCase();
  const email = input.email?.trim().toLowerCase() || "";
  if (!fullName || !username) {
    throw new Error("fullName and username are required");
  }
  if (username.includes("@")) {
    throw new Error("Username must not contain @");
  }
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Active Site Engineer requires a valid email");
  }

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  return withTenant(session, async (client) => {
    const res = await client.query(
      `INSERT INTO users (
         org_id, full_name, username, password_hash, email, role, status, must_change_password
       ) VALUES ($1, $2, $3, $4, $5, 'Site Engineer', 'Active', true)
       RETURNING id, full_name, username, email, role`,
      [
        session.user.orgId,
        fullName,
        username,
        passwordHash,
        email,
      ]
    );
    const user = res.rows[0];

    await audit(client, session.user.id, "user", user.id, "create", {
      username: user.username,
      role: user.role,
    });

    return { user, tempPassword };
  });
}

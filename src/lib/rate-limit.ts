/**
 * Login rate limiting (Slice 1b)
 * Uses login_attempts table. Thresholds are conservative defaults.
 */

import { neon } from "@neondatabase/serverless";

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_IDENTIFIER = 10;
const MAX_FAILURES_PER_IP = 30;

export async function checkLoginRateLimit(opts: {
  orgSlug: string;
  identifier: string;
  ip: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const url = process.env.DATABASE_URL;
  if (!url) return { allowed: true };

  const sql = neon(url);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const [byId] = await sql`
    SELECT count(*)::int AS c
    FROM login_attempts
    WHERE org_slug = ${opts.orgSlug.toLowerCase()}
      AND lower(identifier) = lower(${opts.identifier})
      AND success = false
      AND attempted_at >= ${since}::timestamptz
  `;

  if ((byId?.c as number) >= MAX_FAILURES_PER_IDENTIFIER) {
    return {
      allowed: false,
      reason: "Too many failed attempts. Try again in 15 minutes.",
    };
  }

  const [byIp] = await sql`
    SELECT count(*)::int AS c
    FROM login_attempts
    WHERE ip = ${opts.ip}
      AND success = false
      AND attempted_at >= ${since}::timestamptz
  `;

  if ((byIp?.c as number) >= MAX_FAILURES_PER_IP) {
    return {
      allowed: false,
      reason: "Too many failed attempts from this network. Try again later.",
    };
  }

  return { allowed: true };
}

export async function recordLoginAttempt(opts: {
  orgSlug: string;
  identifier: string;
  ip: string;
  success: boolean;
}) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = neon(url);
  await sql`
    INSERT INTO login_attempts (org_slug, identifier, ip, success)
    VALUES (
      ${opts.orgSlug.toLowerCase()},
      ${opts.identifier.toLowerCase()},
      ${opts.ip},
      ${opts.success}
    )
  `;
}

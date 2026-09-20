/**
 * Incremental migration: auth_session_check
 *
 * Replaces the JWT callback's direct SELECT on users/organizations
 * (which ran as table owner and bypassed RLS) with a SECURITY DEFINER
 * function — the same pattern as auth_lookup_user.
 *
 * Run once:
 *   npx tsx src/scripts/migrate-session-check.ts
 */

import { neon } from "@neondatabase/serverless";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  // optional
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required in .env.local");
    process.exit(1);
  }

  const sql = neon(url);

  console.log("Creating auth_session_check...");

  await sql`
    CREATE OR REPLACE FUNCTION auth_session_check(
      p_user_id uuid,
      p_org_id uuid,
      p_token_version integer
    )
    RETURNS TABLE (
      ok boolean,
      must_change_password boolean,
      role text,
      org_slug text,
      full_name text
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_user_status text;
      v_token_version integer;
      v_must_change boolean;
      v_role text;
      v_full_name text;
      v_org_status text;
      v_org_slug text;
    BEGIN
      -- Intentional: SECURITY DEFINER reads across RLS to validate the session kill-switch.
      -- This is the ONLY path that may read users/orgs without a tenant GUC.
      SELECT u.status, u.token_version, u.must_change_password, u.role, u.full_name,
             o.status, o.slug
        INTO v_user_status, v_token_version, v_must_change, v_role, v_full_name,
             v_org_status, v_org_slug
        FROM users u
        JOIN organizations o ON o.id = u.org_id
       WHERE u.id = p_user_id
         AND u.org_id = p_org_id;

      IF v_user_status IS NULL THEN
        RETURN QUERY SELECT false, false, NULL::text, NULL::text, NULL::text;
        RETURN;
      END IF;

      IF v_user_status <> 'Active'
         OR v_org_status <> 'Active'
         OR v_token_version <> p_token_version THEN
        RETURN QUERY SELECT false, false, NULL::text, NULL::text, NULL::text;
        RETURN;
      END IF;

      RETURN QUERY SELECT true, v_must_change, v_role, v_org_slug, v_full_name;
    END;
    $$
  `;

  await sql`REVOKE ALL ON FUNCTION auth_session_check(uuid, uuid, integer) FROM PUBLIC`;
  await sql`GRANT EXECUTE ON FUNCTION auth_session_check(uuid, uuid, integer) TO app_user`;

  // Also expose full_name from auth_lookup_user so authorize() never needs a second RLS-bound SELECT
  console.log("Updating auth_lookup_user to return full_name...");
  await sql`
    CREATE OR REPLACE FUNCTION auth_lookup_user(
      p_org_slug text,
      p_identifier text
    )
    RETURNS TABLE (
      id uuid,
      org_id uuid,
      password_hash text,
      status text,
      role text,
      must_change_password boolean,
      token_version integer,
      organization_status text,
      full_name text
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_org_id uuid;
      v_org_status text;
      v_is_email boolean;
    BEGIN
      SELECT o.id, o.status INTO v_org_id, v_org_status
      FROM organizations o
      WHERE lower(o.slug) = lower(trim(p_org_slug));

      IF v_org_id IS NULL THEN
        RETURN;
      END IF;

      PERFORM set_config('app.current_org_id', v_org_id::text, true);

      v_is_email := position('@' in p_identifier) > 0;

      IF v_is_email THEN
        RETURN QUERY
        SELECT u.id, u.org_id, u.password_hash, u.status, u.role,
               u.must_change_password, u.token_version, v_org_status, u.full_name
        FROM users u
        WHERE u.org_id = v_org_id
          AND lower(u.email) = lower(trim(p_identifier));
      ELSE
        RETURN QUERY
        SELECT u.id, u.org_id, u.password_hash, u.status, u.role,
               u.must_change_password, u.token_version, v_org_status, u.full_name
        FROM users u
        WHERE u.org_id = v_org_id
          AND lower(u.username) = lower(trim(p_identifier));
      END IF;
    END;
    $$
  `;
  await sql`REVOKE ALL ON FUNCTION auth_lookup_user(text, text) FROM PUBLIC`;
  await sql`GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text) TO app_user`;

  console.log("\n\u2705 auth_session_check + updated auth_lookup_user ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Slice 3 close-out hardening migration.
 * - Unified append_activity_log that reads actor from app.current_user_id (GUC)
 * - Drop append_activity_event
 * - Composite FKs for submissions.user_id, blockers.raised_by / resolved_by
 * - CHECKs for role, status, priority, phase, severity, kind
 * - app_login role (NOBYPASSRLS) membership + grants
 *
 * Run as Neon owner:
 *   npx tsx src/scripts/migrate-hardening.ts
 *
 * After this, create the app_login password in Neon (or via SQL) and set:
 *   DATABASE_URL_APP=postgresql://app_login:...@.../neondb?sslmode=require
 * Keep DATABASE_URL as the owner string for migrations only.
 */

import { neon } from "@neondatabase/serverless";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* optional */
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL (owner) required.");
    process.exit(1);
  }
  const sql = neon(url);

  console.log("1. Create app_login role (NOLOGIN until you set password)...");
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_login') THEN
        CREATE ROLE app_login LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
      -- Ensure app_user exists
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
      END IF;
      -- Membership: app_login can SET ROLE app_user
      GRANT app_user TO app_login;
    END
    $$
  `;

  console.log("2. Grants for app_user / app_login...");
  await sql`GRANT USAGE ON SCHEMA public TO app_user`;
  await sql`GRANT USAGE ON SCHEMA public TO app_login`;
  // Table grants already largely present; reinforce
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`;
  await sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user`;
  await sql`GRANT SELECT ON organizations TO app_user`;
  await sql`GRANT SELECT, INSERT ON login_attempts TO app_user`;
  // activity_log: SELECT only; writes only via SECURITY DEFINER function
  await sql`REVOKE INSERT, UPDATE, DELETE ON activity_log FROM app_user`;
  await sql`GRANT SELECT ON activity_log TO app_user`;

  console.log("3. Unified append_activity_log (actor from GUC only)...");
  // Drop old overloads if present
  await sql`DROP FUNCTION IF EXISTS append_activity_event(uuid, uuid, uuid, text, text, uuid, text, text, text)`;
  await sql`DROP FUNCTION IF EXISTS append_activity_log(uuid, text, uuid, text, jsonb, jsonb, jsonb)`;

  await sql`
    CREATE OR REPLACE FUNCTION append_activity_log(
      p_project_id uuid,
      p_submission_id uuid,
      p_action text,
      p_entity_type text,
      p_entity_id uuid,
      p_field text,
      p_old_value text,
      p_new_value text,
      p_old_values jsonb DEFAULT NULL,
      p_new_values jsonb DEFAULT NULL,
      p_metadata jsonb DEFAULT NULL
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_org_id uuid;
      v_actor_id uuid;
      v_log_id uuid;
    BEGIN
      BEGIN
        v_org_id := current_setting('app.current_org_id', true)::uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'append_activity_log requires app.current_org_id';
      END;
      IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'append_activity_log requires app.current_org_id';
      END IF;

      BEGIN
        v_actor_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
      END;

      -- Verify project belongs to tenant when provided
      IF p_project_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = p_project_id AND p.org_id = v_org_id
        ) THEN
          RAISE EXCEPTION 'append_activity_log: project does not belong to tenant';
        END IF;
      END IF;

      INSERT INTO activity_log (
        org_id, actor_id, project_id, submission_id, action,
        entity_type, entity_id, field, old_value, new_value,
        old_values, new_values, metadata, timestamp
      ) VALUES (
        v_org_id, v_actor_id, p_project_id, p_submission_id, p_action,
        p_entity_type, p_entity_id, p_field, p_old_value, p_new_value,
        p_old_values, p_new_values, p_metadata, now()
      )
      RETURNING id INTO v_log_id;

      RETURN v_log_id;
    END;
    $$
  `;
  await sql`REVOKE ALL ON FUNCTION append_activity_log(uuid, uuid, text, text, uuid, text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC`;
  await sql`GRANT EXECUTE ON FUNCTION append_activity_log(uuid, uuid, text, text, uuid, text, text, text, jsonb, jsonb, jsonb) TO app_user`;

  console.log("4. Composite FKs for user references...");
  // submissions.user_id
  await sql`ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_user_fk`;
  await sql`
    ALTER TABLE submissions
    ADD CONSTRAINT submissions_user_fk
    FOREIGN KEY (org_id, user_id) REFERENCES users (org_id, id)
  `;
  // blockers.raised_by
  await sql`ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_raised_by_fk`;
  await sql`
    ALTER TABLE blockers
    ADD CONSTRAINT blockers_raised_by_fk
    FOREIGN KEY (org_id, raised_by) REFERENCES users (org_id, id)
  `;
  // blockers.resolved_by (nullable)
  await sql`ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_resolved_by_fk`;
  await sql`
    ALTER TABLE blockers
    ADD CONSTRAINT blockers_resolved_by_fk
    FOREIGN KEY (org_id, resolved_by) REFERENCES users (org_id, id)
  `;
  // project_assignments.assigned_by
  await sql`ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_assigned_by_fk`;
  await sql`
    ALTER TABLE project_assignments
    ADD CONSTRAINT project_assignments_assigned_by_fk
    FOREIGN KEY (org_id, assigned_by) REFERENCES users (org_id, id)
  `;

  console.log("5. CHECK constraints...");
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
  await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('Admin', 'Site Engineer'))`;

  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check`;
  await sql`ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('Active', 'Disabled'))`;

  await sql`ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check`;
  await sql`ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (project_status IN ('In Progress', 'Not Started Yet', 'On Hold', 'Delayed', 'Completed'))`;

  await sql`ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_check`;
  await sql`ALTER TABLE projects ADD CONSTRAINT projects_priority_check CHECK (project_priority IN ('High', 'Medium', 'Low'))`;

  await sql`ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_phase_check`;
  await sql`
    ALTER TABLE projects ADD CONSTRAINT projects_phase_check CHECK (
      current_phase IN (
        'Site Survey',
        '1st Fix Civil & Conduits',
        '2nd Fix Cable Pulling',
        '3rd Fix Device Installation',
        '3rd Fix Testing & Commissioning',
        'Official Handover'
      )
    )
  `;

  await sql`ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_kind_check`;
  await sql`ALTER TABLE submissions ADD CONSTRAINT submissions_kind_check CHECK (kind IN ('daily_update', 'admin_edit', 'blocker', 'attachment'))`;

  await sql`ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_severity_check`;
  await sql`ALTER TABLE blockers ADD CONSTRAINT blockers_severity_check CHECK (severity IN ('Low', 'Medium', 'High'))`;

  await sql`ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_status_check`;
  await sql`ALTER TABLE blockers ADD CONSTRAINT blockers_status_check CHECK (status IN ('Open', 'Resolved'))`;

  await sql`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check`;
  await sql`ALTER TABLE organizations ADD CONSTRAINT organizations_status_check CHECK (status IN ('Active', 'Suspended'))`;

  console.log("\n✅ Hardening migration complete.");
  console.log("\nNext steps (required for production):");
  console.log("1. Set password for app_login in Neon SQL editor:");
  console.log("     ALTER ROLE app_login WITH PASSWORD 'strong-random-password';");
  console.log("2. Add to Vercel / .env.local:");
  console.log("     DATABASE_URL_APP=postgresql://app_login:PASSWORD@HOST/neondb?sslmode=require");
  console.log("3. Keep DATABASE_URL as the owner connection for migrations only.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

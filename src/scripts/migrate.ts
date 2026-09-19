/**
 * Apply Slice 1 foundation migration.
 * Uses Neon HTTP driver (tagged templates only).
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."
 *   npx tsx src/scripts/migrate.ts
 *
 * Or create .env.local with DATABASE_URL=...
 */

import { neon } from "@neondatabase/serverless";

// Optional dotenv – works if installed, ignored otherwise
try {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
} catch {
  // fine – user can set process.env.DATABASE_URL directly
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required.");
    console.error("On Windows PowerShell run this first:");
    console.error('  $env:DATABASE_URL="postgresql://neondb_owner:...@...neon.tech/neondb?sslmode=require"');
    console.error("Then re-run: npx tsx src/scripts/migrate.ts");
    process.exit(1);
  }

  const sql = neon(url);

  console.log("1. Creating control-plane + tenant tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL,
      plan_tier text NOT NULL DEFAULT 'standard',
      status text NOT NULL DEFAULT 'Active',
      timezone text NOT NULL DEFAULT 'Asia/Dubai',
      compliance_cutoff_time text NOT NULL DEFAULT '18:00',
      working_days jsonb NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug)`;

  await sql`
    CREATE TABLE IF NOT EXISTS platform_admins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      token_version integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_slug text NOT NULL,
      identifier text NOT NULL,
      ip text NOT NULL,
      attempted_at timestamptz NOT NULL DEFAULT now(),
      success boolean NOT NULL DEFAULT false
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS login_attempts_org_identifier_idx ON login_attempts (org_slug, identifier, attempted_at)`;
  await sql`CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip, attempted_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES organizations(id),
      full_name text NOT NULL,
      username text NOT NULL,
      password_hash text NOT NULL,
      email text,
      phone_number text,
      role text NOT NULL,
      status text NOT NULL DEFAULT 'Active',
      must_change_password boolean NOT NULL DEFAULT true,
      token_version integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_org_username_lower_idx ON users (org_id, lower(username))`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_org_email_lower_idx ON users (org_id, lower(email)) WHERE email IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS users_org_id_idx ON users (org_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES organizations(id),
      project_name text NOT NULL,
      client_name text NOT NULL,
      location text,
      po_number text,
      contract_number text,
      planned_start_date timestamptz,
      target_completion_date timestamptz,
      warranty_period text,
      project_solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
      project_status text NOT NULL DEFAULT 'Not Started Yet',
      project_priority text NOT NULL DEFAULT 'Medium',
      current_phase text NOT NULL DEFAULT 'Site Survey',
      version integer NOT NULL DEFAULT 1,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS projects_org_id_id_idx ON projects (org_id, id)`;
  await sql`CREATE INDEX IF NOT EXISTS projects_org_id_idx ON projects (org_id)`;
  await sql`CREATE INDEX IF NOT EXISTS projects_org_status_idx ON projects (org_id, project_status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS project_assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      user_id uuid NOT NULL,
      assigned_at timestamptz NOT NULL DEFAULT now(),
      assigned_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS project_assignments_project_user_idx ON project_assignments (project_id, user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS project_assignments_org_id_idx ON project_assignments (org_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS boq_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      item_no text NOT NULL,
      item_description text NOT NULL,
      unit text NOT NULL DEFAULT 'EA',
      po_qty numeric(12,2) NOT NULL DEFAULT 0,
      delivered_qty numeric(12,2) NOT NULL DEFAULT 0,
      installed_qty numeric(12,2) NOT NULL DEFAULT 0,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS boq_items_org_project_idx ON boq_items (org_id, project_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      actor_id uuid,
      entity_type text NOT NULL,
      entity_id uuid,
      action text NOT NULL,
      old_values jsonb,
      new_values jsonb,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS activity_log_org_id_idx ON activity_log (org_id)`;
  await sql`CREATE INDEX IF NOT EXISTS activity_log_org_entity_idx ON activity_log (org_id, entity_type, entity_id)`;

  console.log("2. Creating app_user role...");
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
      END IF;
    END
    $$
  `;

  console.log("3. Enabling RLS + FORCE RLS...");
  await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE users FORCE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE projects FORCE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE project_assignments FORCE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE boq_items FORCE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE activity_log FORCE ROW LEVEL SECURITY`;

  console.log("4. Creating tenant isolation policies...");
  await sql`DROP POLICY IF EXISTS users_tenant_isolation ON users`;
  await sql`
    CREATE POLICY users_tenant_isolation ON users
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;
  await sql`DROP POLICY IF EXISTS projects_tenant_isolation ON projects`;
  await sql`
    CREATE POLICY projects_tenant_isolation ON projects
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;
  await sql`DROP POLICY IF EXISTS project_assignments_tenant_isolation ON project_assignments`;
  await sql`
    CREATE POLICY project_assignments_tenant_isolation ON project_assignments
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;
  await sql`DROP POLICY IF EXISTS boq_items_tenant_isolation ON boq_items`;
  await sql`
    CREATE POLICY boq_items_tenant_isolation ON boq_items
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;
  await sql`DROP POLICY IF EXISTS activity_log_tenant_isolation ON activity_log`;
  await sql`
    CREATE POLICY activity_log_tenant_isolation ON activity_log
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;

  console.log("5. Composite unique + foreign keys...");
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_id_unique`;
  await sql`ALTER TABLE users ADD CONSTRAINT users_org_id_id_unique UNIQUE (org_id, id)`;

  await sql`ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_project_fk`;
  await sql`
    ALTER TABLE project_assignments
    ADD CONSTRAINT project_assignments_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE
  `;

  await sql`ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_user_fk`;
  await sql`
    ALTER TABLE project_assignments
    ADD CONSTRAINT project_assignments_user_fk
    FOREIGN KEY (org_id, user_id) REFERENCES users (org_id, id) ON DELETE CASCADE
  `;

  await sql`ALTER TABLE boq_items DROP CONSTRAINT IF EXISTS boq_items_project_fk`;
  await sql`
    ALTER TABLE boq_items
    ADD CONSTRAINT boq_items_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE
  `;

  console.log("6. Quantity CHECK constraint...");
  await sql`ALTER TABLE boq_items DROP CONSTRAINT IF EXISTS boq_items_qty_check`;
  await sql`
    ALTER TABLE boq_items
    ADD CONSTRAINT boq_items_qty_check
    CHECK (
      installed_qty <= delivered_qty
      AND delivered_qty <= po_qty
      AND installed_qty >= 0
      AND delivered_qty >= 0
      AND po_qty >= 0
    )
  `;

  console.log("7. SECURITY DEFINER: auth_lookup_user...");
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
      organization_status text
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
               u.must_change_password, u.token_version, v_org_status
        FROM users u
        WHERE u.org_id = v_org_id
          AND lower(u.email) = lower(trim(p_identifier));
      ELSE
        RETURN QUERY
        SELECT u.id, u.org_id, u.password_hash, u.status, u.role,
               u.must_change_password, u.token_version, v_org_status
        FROM users u
        WHERE u.org_id = v_org_id
          AND lower(u.username) = lower(trim(p_identifier));
      END IF;
    END;
    $$
  `;
  await sql`REVOKE ALL ON FUNCTION auth_lookup_user(text, text) FROM PUBLIC`;
  await sql`GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text) TO app_user`;

  console.log("8. SECURITY DEFINER: append_activity_log...");
  await sql`
    CREATE OR REPLACE FUNCTION append_activity_log(
      p_actor_id uuid,
      p_entity_type text,
      p_entity_id uuid,
      p_action text,
      p_old_values jsonb DEFAULT NULL,
      p_new_values jsonb DEFAULT NULL,
      p_metadata jsonb DEFAULT NULL
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_org_id uuid;
      v_log_id uuid;
    BEGIN
      v_org_id := current_setting('app.current_org_id', true)::uuid;
      IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'append_activity_log requires app.current_org_id to be set';
      END IF;

      INSERT INTO activity_log (
        org_id, actor_id, entity_type, entity_id, action,
        old_values, new_values, metadata
      ) VALUES (
        v_org_id, p_actor_id, p_entity_type, p_entity_id, p_action,
        p_old_values, p_new_values, p_metadata
      )
      RETURNING id INTO v_log_id;

      RETURN v_log_id;
    END;
    $$
  `;
  await sql`REVOKE ALL ON FUNCTION append_activity_log(uuid, text, uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC`;
  await sql`GRANT EXECUTE ON FUNCTION append_activity_log(uuid, text, uuid, text, jsonb, jsonb, jsonb) TO app_user`;

  console.log("9. Locking down activity_log writes...");
  await sql`REVOKE INSERT, UPDATE, DELETE ON activity_log FROM app_user`;
  await sql`GRANT SELECT ON activity_log TO app_user`;

  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON users TO app_user`;
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO app_user`;
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON project_assignments TO app_user`;
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON boq_items TO app_user`;
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON login_attempts TO app_user`;
  await sql`GRANT SELECT ON organizations TO app_user`;

  console.log("\n✅ Slice 1 foundation migration complete");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

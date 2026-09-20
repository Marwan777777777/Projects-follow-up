/**
 * Additive migration: attachments table (Spec 3.13)
 * Run: npx tsx src/scripts/migrate-attachments.ts
 */
import { neon } from "@neondatabase/serverless";
try { require("dotenv").config({ path: ".env.local" }); } catch { /* optional */ }

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL required"); process.exit(1); }
  const sql = neon(url);

  console.log("1. attachments table...");
  await sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      submission_id uuid,
      blocker_id uuid,
      r2_key text NOT NULL,
      file_name text NOT NULL,
      file_type text NOT NULL,
      size_bytes bigint NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      uploaded_by uuid NOT NULL,
      uploaded_at timestamptz,
      deleted_at timestamptz,
      multipart_upload_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (org_id, id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS attachments_org_project_status_idx ON attachments (org_id, project_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS attachments_org_status_created_idx ON attachments (org_id, status, created_at)`;

  console.log("2. Unique parent keys + composite FKs...");
  await sql`ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_org_id_id_unique`;
  await sql`ALTER TABLE projects ADD CONSTRAINT projects_org_id_id_unique UNIQUE (org_id, id)`;
  await sql`DO $$ BEGIN
    ALTER TABLE submissions ADD CONSTRAINT submissions_org_id_id_unique UNIQUE (org_id, id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE blockers ADD CONSTRAINT blockers_org_id_id_unique UNIQUE (org_id, id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  await sql`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_project_fk`;
  await sql`ALTER TABLE attachments ADD CONSTRAINT attachments_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)`;
  await sql`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_submission_fk`;
  await sql`ALTER TABLE attachments ADD CONSTRAINT attachments_submission_fk
    FOREIGN KEY (org_id, submission_id) REFERENCES submissions (org_id, id)`;
  await sql`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_blocker_fk`;
  await sql`ALTER TABLE attachments ADD CONSTRAINT attachments_blocker_fk
    FOREIGN KEY (org_id, blocker_id) REFERENCES blockers (org_id, id)`;

  console.log("3. RLS + FORCE RLS...");
  await sql`ALTER TABLE attachments ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE attachments FORCE ROW LEVEL SECURITY`;
  await sql`DROP POLICY IF EXISTS attachments_tenant_isolation ON attachments`;
  await sql`CREATE POLICY attachments_tenant_isolation ON attachments
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)`;

  console.log("4. Grants + status check...");
  await sql`GRANT SELECT, INSERT, UPDATE ON attachments TO app_user`;
  await sql`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_status_check`;
  await sql`ALTER TABLE attachments ADD CONSTRAINT attachments_status_check
    CHECK (status IN ('pending', 'ready', 'rejected'))`;

  console.log("Attachments migration complete.");
}
main().catch((e) => { console.error(e); process.exit(1); });

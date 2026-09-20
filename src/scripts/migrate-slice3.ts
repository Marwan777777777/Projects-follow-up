/**
 * Slice 3 additive migration: submissions, blockers, BOQ notes,
 * activity_log spec columns, grants + RLS.
 *
 *   npx tsx src/scripts/migrate-slice3.ts
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
    console.error("DATABASE_URL required.");
    process.exit(1);
  }
  const sql = neon(url);

  console.log("1. BOQ notes column...");
  await sql`ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS notes text`;

  console.log("2. activity_log spec columns...");
  await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS project_id uuid`;
  await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS submission_id uuid`;
  await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS field text`;
  await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS old_value text`;
  await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS new_value text`;
  await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS timestamp timestamptz NOT NULL DEFAULT now()`;

  console.log("3. submissions...");
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id uuid NOT NULL,
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      user_id uuid NOT NULL,
      kind text NOT NULL,
      submitted_at timestamptz NOT NULL DEFAULT now(),
      client_submitted_at timestamptz,
      request_fingerprint text NOT NULL,
      notes text,
      no_change boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (org_id, id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS submissions_org_project_idx ON submissions (org_id, project_id, submitted_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS submissions_org_user_idx ON submissions (org_id, user_id, submitted_at DESC)`;

  console.log("4. blockers...");
  await sql`
    CREATE TABLE IF NOT EXISTS blockers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      raised_by uuid NOT NULL,
      description text NOT NULL,
      severity text NOT NULL,
      status text NOT NULL DEFAULT 'Open',
      raised_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz,
      resolved_by uuid,
      resolution_note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS blockers_org_project_idx ON blockers (org_id, project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS blockers_org_status_idx ON blockers (org_id, status)`;

  console.log("5. Unique parent keys for composite FKs...");
  await sql`ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_org_id_id_unique`;
  await sql`ALTER TABLE blockers ADD CONSTRAINT blockers_org_id_id_unique UNIQUE (org_id, id)`;

  await sql`ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_project_fk`;
  await sql`
    ALTER TABLE blockers
    ADD CONSTRAINT blockers_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
  `;

  await sql`ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_project_fk`;
  await sql`
    ALTER TABLE submissions
    ADD CONSTRAINT submissions_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
  `;

  console.log("6. RLS...");
  await sql`ALTER TABLE submissions ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE submissions FORCE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE blockers ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE blockers FORCE ROW LEVEL SECURITY`;

  await sql`DROP POLICY IF EXISTS submissions_tenant_isolation ON submissions`;
  await sql`
    CREATE POLICY submissions_tenant_isolation ON submissions
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;
  await sql`DROP POLICY IF EXISTS blockers_tenant_isolation ON blockers`;
  await sql`
    CREATE POLICY blockers_tenant_isolation ON blockers
      USING (org_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
  `;

  console.log("7. Grants...");
  await sql`GRANT SELECT, INSERT, UPDATE ON submissions TO app_user`;
  await sql`GRANT SELECT, INSERT, UPDATE ON blockers TO app_user`;

  console.log("8. append_activity_event...");
  await sql`
    CREATE OR REPLACE FUNCTION append_activity_event(
      p_actor_id uuid,
      p_project_id uuid,
      p_submission_id uuid,
      p_action text,
      p_entity_type text,
      p_entity_id uuid,
      p_field text,
      p_old_value text,
      p_new_value text
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
        RAISE EXCEPTION 'append_activity_event requires app.current_org_id';
      END IF;

      IF p_project_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = p_project_id AND p.org_id = v_org_id
        ) THEN
          RAISE EXCEPTION 'append_activity_event: project does not belong to tenant';
        END IF;
      END IF;

      INSERT INTO activity_log (
        org_id, actor_id, project_id, submission_id, action,
        entity_type, entity_id, field, old_value, new_value, timestamp,
        new_values
      ) VALUES (
        v_org_id, p_actor_id, p_project_id, p_submission_id, p_action,
        p_entity_type, p_entity_id, p_field, p_old_value, p_new_value, now(),
        CASE WHEN p_field IS NULL THEN to_jsonb(p_new_value) ELSE NULL END
      )
      RETURNING id INTO v_log_id;

      RETURN v_log_id;
    END;
    $$
  `;
  await sql`REVOKE ALL ON FUNCTION append_activity_event(uuid, uuid, uuid, text, text, uuid, text, text, text) FROM PUBLIC`;
  await sql`GRANT EXECUTE ON FUNCTION append_activity_event(uuid, uuid, uuid, text, text, uuid, text, text, text) TO app_user`;

  console.log("Slice 3 migration complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

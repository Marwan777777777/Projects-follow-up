/**
 * scripts/create-org
 * Bootstrap an organization + first Admin.
 * Run with migrator / owner connection (bypasses RLS for control-plane inserts).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx src/scripts/create-org.ts --name "Acme ELV" --slug acme --admin-name "Admin User" --admin-username admin --admin-email admin@acme.com
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

function arg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) {
    if (fallback !== undefined) return fallback;
    console.error(`Missing required --${name}`);
    process.exit(1);
  }
  return process.argv[idx + 1];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const name = arg("name");
  const slug = arg("slug").toLowerCase().trim();
  const adminName = arg("admin-name");
  const adminUsername = arg("admin-username").toLowerCase().trim();
  const adminEmail = arg("admin-email", "").toLowerCase().trim() || null;

  // Basic slug validation (full reserved list enforced later)
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug)) {
    console.error("Invalid slug format");
    process.exit(1);
  }

  const reserved = [
    "login", "reset", "forgot-password", "set-password", "platform",
    "admin", "api", "app", "www", "static", "health", "robots", "sitemap",
  ];
  if (reserved.includes(slug)) {
    console.error(`Slug "${slug}" is reserved`);
    process.exit(1);
  }

  // Temporary password — must be changed on first login
  const tempPassword = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const sql = neon(connectionString);

  // Control-plane insert (organizations has no RLS)
  const [org] = await sql`
    INSERT INTO organizations (name, slug, plan_tier, status, timezone, compliance_cutoff_time, working_days)
    VALUES (${name}, ${slug}, 'standard', 'Active', 'Asia/Dubai', '18:00', '[1,2,3,4,5]'::jsonb)
    RETURNING id, name, slug
  `;

  // First Admin — must run with tenant context or as owner
  // For bootstrap we insert as owner (migrator). RLS is FORCE, so we set GUC.
  await sql`SELECT set_config('app.current_org_id', ${org.id}::text, true)`;

  const [user] = await sql`
    INSERT INTO users (
      org_id, full_name, username, password_hash, email, role, status,
      must_change_password, token_version
    ) VALUES (
      ${org.id}, ${adminName}, ${adminUsername}, ${passwordHash}, ${adminEmail},
      'Admin', 'Active', true, 0
    )
    RETURNING id, username, email, role
  `;

  console.log("\n✅ Organization created");
  console.log("----------------------------------------");
  console.log(`  Org ID:     ${org.id}`);
  console.log(`  Name:       ${org.name}`);
  console.log(`  Slug:       ${org.slug}`);
  console.log(`  Login URL:  /login/${org.slug}`);
  console.log("----------------------------------------");
  console.log(`  Admin:      ${user.username} (${user.email || "no email"})`);
  console.log(`  Temp pass:  ${tempPassword}`);
  console.log(`  must_change_password = true`);
  console.log("----------------------------------------");
  console.log("User must change password on first login.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

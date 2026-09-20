/**
 * scripts/create-org
 * Bootstrap an organization + first Admin.
 *
 * Usage:
 *   npx tsx src/scripts/create-org.ts --name "Demo ELV" --slug demo --admin-name "Admin" --admin-username admin --admin-email admin@demo.com
 *
 * DATABASE_URL can come from:
 *   1. --database-url flag
 *   2. process.env.DATABASE_URL
 *   3. .env.local file
 */

import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function arg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) {
    if (fallback !== undefined) return fallback;
    console.error(`Missing required --${name}`);
    process.exit(1);
  }
  return process.argv[idx + 1];
}

function loadEnvLocal() {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // strip surrounding quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
    console.log(`Loaded env from ${file}`);
    return;
  }
}

async function main() {
  loadEnvLocal();

  const connectionString =
    arg("database-url", "") || process.env.DATABASE_URL || "";

  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    console.error("Either:");
    console.error("  1. Create .env.local with DATABASE_URL=...");
    console.error("  2. Pass --database-url \"postgresql://...\"");
    process.exit(1);
  }

  const name = arg("name");
  const slug = arg("slug").toLowerCase().trim();
  const adminName = arg("admin-name");
  const adminUsername = arg("admin-username").toLowerCase().trim();
  const adminEmail = arg("admin-email", "").toLowerCase().trim() || null;

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

  // Dynamic import bcrypt so missing package gives a clear error
  let bcrypt: typeof import("bcryptjs");
  try {
    bcrypt = await import("bcryptjs");
  } catch {
    console.error("bcryptjs is not installed. Run: npm install bcryptjs --legacy-peer-deps");
    process.exit(1);
  }

  const tempPassword = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const sql = neon(connectionString);

  const [org] = await sql`
    INSERT INTO organizations (name, slug, plan_tier, status, timezone, compliance_cutoff_time, working_days)
    VALUES (${name}, ${slug}, 'standard', 'Active', 'Asia/Dubai', '18:00', '[1,2,3,4,5]'::jsonb)
    RETURNING id, name, slug
  `;

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

  console.log("\n\u2705 Organization created");
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

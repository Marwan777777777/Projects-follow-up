import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const hash = await bcrypt.hash(password, 12);
  const sql = neon(url);

  await sql`SELECT set_config('app.current_org_id', ${session.user.orgId}, true)`;
  await sql`
    UPDATE users
    SET password_hash = ${hash},
        must_change_password = false,
        token_version = token_version + 1,
        updated_at = now()
    WHERE id = ${session.user.id}
      AND org_id = ${session.user.orgId}
  `;

  return NextResponse.json({ ok: true });
}

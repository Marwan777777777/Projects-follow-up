import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

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

  try {
    const hash = await bcrypt.hash(password, 12);
    const sql = neon(url);

    // Neon HTTP is stateless — set_config must be in the SAME query as the UPDATE
    // or use a transaction via Pool. Single-statement approach:
    const result = await sql`
      WITH ctx AS (
        SELECT set_config('app.current_org_id', ${session.user.orgId}, true)
      )
      UPDATE users
      SET password_hash = ${hash},
          must_change_password = false,
          token_version = token_version + 1,
          updated_at = now()
      WHERE id = ${session.user.id}
        AND org_id = ${session.user.orgId}
        AND EXISTS (SELECT 1 FROM ctx)
      RETURNING id
    `;

    if (!result.length) {
      return NextResponse.json(
        { error: "User not found or update blocked." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("change-password error:", e);
    return NextResponse.json(
      { error: "Failed to update password." },
      { status: 500 }
    );
  }
}

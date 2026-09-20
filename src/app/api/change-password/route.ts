import { auth } from "@/auth";
import { withTenant } from "@/db/tenant";
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

  try {
    const hash = await bcrypt.hash(password, 12);

    await withTenant(
      {
        user: {
          id: session.user.id,
          orgId: session.user.orgId,
          role: session.user.role,
          tokenVersion: session.user.tokenVersion,
        },
      },
      async (client) => {
        const result = await client.query(
          `UPDATE users
           SET password_hash = $1,
               must_change_password = false,
               token_version = token_version + 1,
               updated_at = now()
           WHERE id = $2 AND org_id = $3
           RETURNING id`,
          [hash, session.user.id, session.user.orgId]
        );
        if (!result.rows.length) {
          throw new Error("User not found or update blocked");
        }
      }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("change-password error:", e);
    return NextResponse.json(
      { error: "Failed to update password." },
      { status: 500 }
    );
  }
}

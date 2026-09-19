import { auth } from "@/auth";
import { listEngineers, listOrgUsers } from "@/services/projects";
import { createEngineer } from "@/services/users";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const engineersOnly = url.searchParams.get("role") === "Site Engineer";

  try {
    const sessionLike = {
      user: {
        id: session.user.id,
        orgId: session.user.orgId,
        role: session.user.role,
        tokenVersion: session.user.tokenVersion,
      },
    };
    const users = engineersOnly
      ? await listEngineers(sessionLike)
      : await listOrgUsers(sessionLike);
    return NextResponse.json({ users });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list users" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { fullName?: string; username?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await createEngineer(
      {
        user: {
          id: session.user.id,
          orgId: session.user.orgId,
          role: session.user.role,
          tokenVersion: session.user.tokenVersion,
        },
      },
      {
        fullName: body.fullName || "",
        username: body.username || "",
        email: body.email,
      }
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create user";
    // Only return safe domain messages
    const safe =
      msg.startsWith("Only ") ||
      msg.includes("required") ||
      msg.includes("must not") ||
      msg.includes("duplicate")
        ? msg
        : "Failed to create user";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}

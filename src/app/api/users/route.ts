import { auth } from "@/auth";
import { listOrgUsers } from "@/services/projects";
import { createEngineer } from "@/services/users";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await listOrgUsers({
      user: {
        id: session.user.id,
        orgId: session.user.orgId,
        role: session.user.role,
        tokenVersion: session.user.tokenVersion,
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list users";
    return NextResponse.json({ error: msg }, { status: 403 });
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

  let body: {
    fullName?: string;
    username?: string;
    email?: string;
  };
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
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { auth } from "@/auth";
import { listOrgUsers } from "@/services/projects";
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
